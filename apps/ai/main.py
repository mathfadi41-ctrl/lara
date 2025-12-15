import os
import io
import time
import logging
import base64
import asyncio
import psutil
from typing import List, Optional, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import numpy as np
import cv2
from PIL import Image
import torch
from ultralytics import YOLO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables
model = None
model_path = None
device = None
is_warmed_up = False
inference_times = []
detection_stats = {
    "total_requests": 0,
    "detection_enabled_requests": 0,
    "total_detections": 0,
    "avg_inference_time": 0.0,
    "fps": 0.0
}

# Pydantic models
class BoundingBox(BaseModel):
    x: int = Field(..., description="X coordinate of bounding box top-left corner")
    y: int = Field(..., description="Y coordinate of bounding box top-left corner")
    width: int = Field(..., description="Width of bounding box")
    height: int = Field(..., description="Height of bounding box")

class Detection(BaseModel):
    label: str = Field(..., description="Class label of detected object")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score (0-1)")
    boundingBox: BoundingBox = Field(..., description="Bounding box coordinates")

class DetectionRequest(BaseModel):
    streamId: Optional[str] = Field(None, description="Stream identifier")
    enableDetection: bool = Field(True, description="Enable/disable detection for this request")
    confidenceThreshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence threshold override")

class DetectionResponse(BaseModel):
    detections: List[Detection] = Field(default_factory=list, description="List of detections")
    inferenceTime: float = Field(..., description="Inference time in seconds")
    modelInfo: dict = Field(..., description="Model information")
    streamId: Optional[str] = Field(None, description="Echoed stream identifier")
    enabled: bool = Field(..., description="Whether detection was enabled")

class StatusResponse(BaseModel):
    status: str = Field(..., description="Service status")
    modelLoaded: bool = Field(..., description="Whether model is loaded")
    device: str = Field(..., description="Computation device")
    gpu: Optional[dict] = Field(None, description="GPU information if available")
    fps: float = Field(..., description="Average frames per second")
    avgInferenceTime: float = Field(..., description="Average inference time")
    memoryUsage: dict = Field(..., description="Memory usage statistics")
    uptime: float = Field(..., description="Service uptime in seconds")
    stats: dict = Field(..., description="Detection statistics")

class HealthResponse(BaseModel):
    status: str = Field(..., description="Health status")
    modelLoaded: bool = Field(..., description="Whether model is loaded")
    version: str = Field(..., description="Service version")
    timestamp: float = Field(..., description="Current timestamp")

# Global startup time
startup_time = time.time()

def get_device_info():
    """Get device information for inference."""
    global device
    
    preferred_device = os.getenv("DEVICE", "auto")
    
    if preferred_device == "auto":
        if torch.cuda.is_available():
            device = torch.device("cuda")
            return "cuda"
        else:
            device = torch.device("cpu")
            return "cpu"
    elif preferred_device == "cuda" and torch.cuda.is_available():
        device = torch.device("cuda")
        return "cuda"
    else:
        device = torch.device("cpu")
        return "cpu"

def load_model():
    """Load YOLO model for fire/smoke/hotspot detection."""
    global model, model_path, is_warmed_up
    
    model_path = os.getenv("MODEL_PATH", "./models/yolov8n.pt")
    models_dir = os.getenv("MODELS_DIR", "./models")
    
    # Create models directory if it doesn't exist
    os.makedirs(models_dir, exist_ok=True)
    
    # Download model if it doesn't exist
    if not os.path.exists(model_path):
        logger.info(f"Model not found at {model_path}, downloading...")
        # For fire/smoke detection, we can use a general YOLOv8 model
        # In production, you might want to use a custom trained model
        model_path = "yolov8n.pt"  # ultralytics will handle downloading
    
    try:
        logger.info(f"Loading model from {model_path}...")
        model = YOLO(model_path)
        model.to(device)
        
        # Warm up the model
        logger.info("Warming up model...")
        dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
        results = model(dummy_image, verbose=False)
        is_warmed_up = True
        
        logger.info(f"Model loaded successfully on {get_device_info()}")
        return True
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return False

def process_image(image_data: bytes) -> np.ndarray:
    """Convert image bytes to numpy array for inference."""
    try:
        # Convert bytes to PIL Image
        pil_image = Image.open(io.BytesIO(image_data))
        
        # Convert RGB to BGR for OpenCV
        if pil_image.mode == 'RGB':
            pil_image = pil_image.convert('RGB')
            cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        else:
            cv_image = np.array(pil_image)
            
        return cv_image
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid image data: {e}")

def process_base64_image(base64_data: str) -> np.ndarray:
    """Convert base64 encoded image to numpy array."""
    try:
        # Remove data URL prefix if present
        if base64_data.startswith('data:image'):
            base64_data = base64_data.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(base64_data)
        
        return process_image(image_data)
    except Exception as e:
        logger.error(f"Error processing base64 image: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {e}")

def format_detections(results, confidence_threshold: float = 0.25) -> List[Detection]:
    """Format YOLO results into detection objects."""
    detections = []
    
    if len(results) == 0:
        return detections
    
    result = results[0]  # Get first result
    
    if result.boxes is not None:
        boxes = result.boxes
        names = result.names
        
        for i in range(len(boxes)):
            confidence = float(boxes.conf[i])
            
            if confidence >= confidence_threshold:
                # Get bounding box coordinates
                xyxy = boxes.xyxy[i].cpu().numpy()
                x1, y1, x2, y2 = map(int, xyxy)
                
                # Get class label
                class_id = int(boxes.cls[i])
                label = names[class_id]
                
                detections.append(Detection(
                    label=label,
                    confidence=confidence,
                    boundingBox=BoundingBox(
                        x=x1,
                        y=y1,
                        width=x2 - x1,
                        height=y2 - y1,
                    )
                ))
    
    return detections

def get_gpu_info():
    """Get GPU information if available."""
    if torch.cuda.is_available():
        return {
            "device": torch.cuda.get_device_name(),
            "memory_used": torch.cuda.memory_allocated(),
            "memory_total": torch.cuda.get_device_properties(0).total_memory,
            "compute_capability": torch.cuda.get_device_capability(),
        }
    return None

def update_stats(inference_time: float, detections_count: int, detection_enabled: bool):
    """Update detection statistics."""
    global detection_stats
    
    detection_stats["total_requests"] += 1
    if detection_enabled:
        detection_stats["detection_enabled_requests"] += 1
        detection_stats["total_detections"] += detections_count
        
        inference_times.append(inference_time)
        # Keep only last 100 inference times
        if len(inference_times) > 100:
            inference_times.pop(0)
            
        detection_stats["avg_inference_time"] = sum(inference_times) / len(inference_times)
        
        # Calculate FPS based on recent inference times
        if len(inference_times) >= 10:
            recent_times = inference_times[-10:]
            avg_time = sum(recent_times) / len(recent_times)
            detection_stats["fps"] = 1.0 / avg_time if avg_time > 0 else 0.0

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting AI service...")
    
    if not load_model():
        logger.error("Failed to load model during startup")
        # Don't fail startup, but log the issue
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI service...")

# Create FastAPI app with lifespan manager
app = FastAPI(
    title="Fire/Smoke Detection AI Service",
    description="Microservice for fire, smoke, and hotspot detection using YOLOv8",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if is_warmed_up else "starting",
        modelLoaded=is_warmed_up,
        version="1.0.0",
        timestamp=time.time()
    )

@app.post("/detect", response_model=DetectionResponse)
async def detect(
    file: Optional[UploadFile] = File(None),
    base64_image: Optional[str] = None,
    request_data: Optional[DetectionRequest] = None
):
    """
    Detect fire, smoke, or hotspots in an image.
    
    Supports both file upload and base64 encoded images.
    """
    global detection_stats
    
    if not request_data:
        request_data = DetectionRequest()
    
    start_time = time.time()
    enabled = request_data.enableDetection and os.getenv("ENABLE_DETECTION", "true").lower() == "true"
    
    # Update stats
    update_stats(0, 0, enabled)  # Temporary stats update
    detection_stats["total_requests"] -= 1  # Correct the temporary increment
    
    model_info = {
        "name": "YOLOv8",
        "path": model_path,
        "device": get_device_info(),
        "warmed_up": is_warmed_up,
    }
    
    # If detection is disabled, return empty results
    if not enabled:
        inference_time = time.time() - start_time
        
        update_stats(inference_time, 0, enabled)
        
        return DetectionResponse(
            detections=[],
            inferenceTime=inference_time,
            modelInfo=model_info,
            streamId=request_data.streamId,
            enabled=False
        )
    
    # Validate input
    if not file and not base64_image:
        raise HTTPException(status_code=400, detail="Either file upload or base64_image must be provided")
    
    try:
        # Process image
        if file:
            image_data = await file.read()
            image = process_image(image_data)
        else:
            image = process_base64_image(base64_image)
        
        # Run inference
        if is_warmed_up and model is not None:
            # Resize image for consistent processing (optional)
            original_shape = image.shape[:2]
            # image = cv2.resize(image, (640, 640))  # Uncomment for fixed size
            
            # Run YOLO inference
            confidence_threshold = request_data.confidenceThreshold or float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
            results = model(image, conf=confidence_threshold, verbose=False)
            
            # Format results
            detections = format_detections(results, confidence_threshold)
            
        else:
            # Model not ready
            raise HTTPException(status_code=503, detail="Model not loaded or warmed up")
        
        inference_time = time.time() - start_time
        
        # Update stats
        update_stats(inference_time, len(detections), enabled)
        
        return DetectionResponse(
            detections=detections,
            inferenceTime=inference_time,
            modelInfo=model_info,
            streamId=request_data.streamId,
            enabled=True
        )
        
    except Exception as e:
        logger.error(f"Error during detection: {e}")
        raise HTTPException(status_code=500, detail=f"Detection failed: {e}")

@app.get("/status", response_model=StatusResponse)
async def status():
    """Get service status and performance metrics."""
    uptime = time.time() - startup_time
    
    # Get memory usage
    memory = psutil.virtual_memory()
    process = psutil.Process()
    process_memory = process.memory_info()
    
    # Get GPU info
    gpu_info = get_gpu_info()
    
    return StatusResponse(
        status="running" if is_warmed_up else "starting",
        modelLoaded=is_warmed_up,
        device=get_device_info(),
        gpu=gpu_info,
        fps=detection_stats["fps"],
        avgInferenceTime=detection_stats["avg_inference_time"],
        memoryUsage={
            "total": memory.total,
            "available": memory.available,
            "percent": memory.percent,
            "process_rss": process_memory.rss,
            "process_vms": process_memory.vms,
        },
        uptime=uptime,
        stats=detection_stats
    )

# gRPC server stub (for future implementation)
def start_grpc_server():
    """Placeholder for gRPC server implementation."""
    logger.info("gRPC server functionality not yet implemented")
    pass

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    workers = int(os.getenv("CONCURRENCY", "4"))
    
    logger.info(f"Starting AI service on port {port} with {workers} workers")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        workers=workers,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
        access_log=True
    )