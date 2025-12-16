import os
import io
import time
import logging
import base64
import asyncio
import psutil
from typing import List, Optional, Union, Literal
from contextlib import asynccontextmanager
from enum import Enum

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

# Enums for stream types and detection types
class StreamType(str, Enum):
    COLOR = "COLOR"
    THERMAL = "THERMAL"
    SPLIT = "SPLIT"

class SplitLayout(str, Enum):
    LEFT_RIGHT = "LEFT_RIGHT"
    TOP_BOTTOM = "TOP_BOTTOM"

class DetectionType(str, Enum):
    SMOKE = "SMOKE"
    FIRE = "FIRE"
    HOTSPOT = "HOTSPOT"

# Global variables
color_model = None
thermal_model = None
color_model_path = None
thermal_model_path = None
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
    detectionType: DetectionType = Field(..., description="Type of detection (SMOKE, FIRE, HOTSPOT)")
    channel: Optional[str] = Field(None, description="Channel identifier for split streams (color/thermal)")

class DetectionRequest(BaseModel):
    streamId: Optional[str] = Field(None, description="Stream identifier")
    enableDetection: bool = Field(True, description="Enable/disable detection for this request")
    confidenceThreshold: Optional[float] = Field(None, ge=0.0, le=1.0, description="Confidence threshold override")
    streamType: Optional[StreamType] = Field(None, description="Stream type (COLOR, THERMAL, SPLIT)")
    splitLayout: Optional[SplitLayout] = Field(None, description="Split layout for SPLIT streams")
    channel: Optional[str] = Field(None, description="Channel hint for split streams")

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

class ThermalDetector:
    """Thermal hotspot detector using intensity-based thresholding."""
    
    def __init__(self, threshold: float = 200.0):
        self.threshold = threshold
        logger.info(f"Initialized ThermalDetector with threshold={threshold}")
    
    def detect(self, image: np.ndarray, confidence_threshold: float = 0.25) -> List[Detection]:
        """Detect hotspots in thermal image using intensity thresholding."""
        detections = []
        
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Apply threshold to find hotspots
        _, binary = cv2.threshold(gray, self.threshold, 255, cv2.THRESH_BINARY)
        
        # Find contours
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            # Filter small contours
            area = cv2.contourArea(contour)
            if area < 100:  # Minimum area threshold
                continue
            
            # Get bounding box
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate confidence based on mean intensity in the region
            roi = gray[y:y+h, x:x+w]
            mean_intensity = np.mean(roi)
            confidence = min(mean_intensity / 255.0, 1.0)
            
            if confidence >= confidence_threshold:
                detections.append(Detection(
                    label="hotspot",
                    confidence=float(confidence),
                    boundingBox=BoundingBox(x=int(x), y=int(y), width=int(w), height=int(h)),
                    detectionType=DetectionType.HOTSPOT,
                    channel=None
                ))
        
        return detections

def load_color_model():
    """Load YOLO model for RGB fire/smoke detection."""
    global color_model, color_model_path
    
    color_model_path = os.getenv("COLOR_MODEL_PATH", os.getenv("MODEL_PATH", "./models/yolov8n.pt"))
    models_dir = os.getenv("MODELS_DIR", "./models")
    
    # Create models directory if it doesn't exist
    os.makedirs(models_dir, exist_ok=True)
    
    # Download model if it doesn't exist
    if not os.path.exists(color_model_path):
        logger.info(f"Color model not found at {color_model_path}, downloading...")
        color_model_path = "yolov8n.pt"  # ultralytics will handle downloading
    
    try:
        logger.info(f"Loading color model from {color_model_path}...")
        color_model = YOLO(color_model_path)
        color_model.to(device)
        
        # Warm up the model
        logger.info("Warming up color model...")
        dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
        results = color_model(dummy_image, verbose=False)
        
        logger.info(f"Color model loaded successfully on {get_device_info()}")
        return True
    except Exception as e:
        logger.error(f"Failed to load color model: {e}")
        return False

def load_thermal_model():
    """Load thermal model or initialize heuristic detector."""
    global thermal_model, thermal_model_path
    
    thermal_model_path = os.getenv("THERMAL_MODEL_PATH", None)
    thermal_threshold = float(os.getenv("THERMAL_THRESHOLD", "200.0"))
    
    if thermal_model_path and os.path.exists(thermal_model_path):
        try:
            logger.info(f"Loading thermal model from {thermal_model_path}...")
            thermal_model = YOLO(thermal_model_path)
            thermal_model.to(device)
            
            # Warm up the model
            dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
            results = thermal_model(dummy_image, verbose=False)
            
            logger.info(f"Thermal model loaded successfully on {get_device_info()}")
            return True
        except Exception as e:
            logger.error(f"Failed to load thermal model: {e}")
            logger.info("Falling back to heuristic thermal detector")
    
    # Use heuristic-based detector
    thermal_model = ThermalDetector(threshold=thermal_threshold)
    logger.info("Using heuristic-based thermal detector")
    return True

def load_model():
    """Load detection models (for backward compatibility)."""
    global is_warmed_up
    
    # Load color model by default
    success = load_color_model()
    if success:
        is_warmed_up = True
    
    # Attempt to load thermal model (doesn't affect startup if it fails)
    load_thermal_model()
    
    return success

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

def map_label_to_detection_type(label: str) -> DetectionType:
    """Map YOLO class label to DetectionType."""
    label_lower = label.lower()
    if 'fire' in label_lower:
        return DetectionType.FIRE
    elif 'smoke' in label_lower:
        return DetectionType.SMOKE
    elif 'hotspot' in label_lower or 'hot' in label_lower:
        return DetectionType.HOTSPOT
    # Default mapping for common COCO classes that might indicate fire/smoke
    return DetectionType.SMOKE

def format_detections(results, confidence_threshold: float = 0.25, channel: Optional[str] = None) -> List[Detection]:
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
                
                # Map label to detection type
                detection_type = map_label_to_detection_type(label)
                
                detections.append(Detection(
                    label=label,
                    confidence=confidence,
                    boundingBox=BoundingBox(
                        x=x1,
                        y=y1,
                        width=x2 - x1,
                        height=y2 - y1,
                    ),
                    detectionType=detection_type,
                    channel=channel
                ))
    
    return detections

def split_frame(image: np.ndarray, layout: SplitLayout) -> tuple[np.ndarray, np.ndarray]:
    """Split frame according to layout."""
    height, width = image.shape[:2]
    
    if layout == SplitLayout.LEFT_RIGHT:
        mid = width // 2
        left_half = image[:, :mid]
        right_half = image[:, mid:]
        return left_half, right_half
    else:  # TOP_BOTTOM
        mid = height // 2
        top_half = image[:mid, :]
        bottom_half = image[mid:, :]
        return top_half, bottom_half

def remap_bounding_boxes(detections: List[Detection], layout: SplitLayout, is_second_half: bool, original_shape: tuple) -> List[Detection]:
    """Remap bounding boxes from split frame to full frame coordinates."""
    height, width = original_shape[:2]
    remapped = []
    
    for detection in detections:
        bbox = detection.boundingBox
        new_bbox = BoundingBox(x=bbox.x, y=bbox.y, width=bbox.width, height=bbox.height)
        
        if layout == SplitLayout.LEFT_RIGHT:
            if is_second_half:
                # Right half - add offset to x coordinate
                new_bbox.x = bbox.x + (width // 2)
        else:  # TOP_BOTTOM
            if is_second_half:
                # Bottom half - add offset to y coordinate
                new_bbox.y = bbox.y + (height // 2)
        
        remapped.append(Detection(
            label=detection.label,
            confidence=detection.confidence,
            boundingBox=new_bbox,
            detectionType=detection.detectionType,
            channel=detection.channel
        ))
    
    return remapped

def detect_color(image: np.ndarray, confidence_threshold: float, channel: Optional[str] = None) -> List[Detection]:
    """Run color detection pipeline for smoke/fire."""
    if color_model is None:
        logger.error("Color model not loaded")
        return []
    
    if isinstance(color_model, YOLO):
        results = color_model(image, conf=confidence_threshold, verbose=False)
        return format_detections(results, confidence_threshold, channel)
    else:
        return []

def detect_thermal(image: np.ndarray, confidence_threshold: float, channel: Optional[str] = None) -> List[Detection]:
    """Run thermal detection pipeline for hotspots."""
    if thermal_model is None:
        logger.error("Thermal model not loaded")
        return []
    
    if isinstance(thermal_model, ThermalDetector):
        # Use heuristic detector
        detections = thermal_model.detect(image, confidence_threshold)
        # Update channel for all detections
        for det in detections:
            det.channel = channel
        return detections
    elif isinstance(thermal_model, YOLO):
        # Use YOLO thermal model
        results = thermal_model(image, conf=confidence_threshold, verbose=False)
        detections = format_detections(results, confidence_threshold, channel)
        # Ensure all detections are marked as HOTSPOT
        for det in detections:
            det.detectionType = DetectionType.HOTSPOT
        return detections
    else:
        return []

def detect_split(image: np.ndarray, layout: SplitLayout, confidence_threshold: float) -> List[Detection]:
    """Run detection on split frame (both color and thermal halves)."""
    original_shape = image.shape
    
    # Split the frame
    first_half, second_half = split_frame(image, layout)
    
    # Run color detection on first half (assumed to be color/RGB)
    color_detections = detect_color(first_half, confidence_threshold, channel="color")
    
    # Run thermal detection on second half (assumed to be thermal)
    thermal_detections = detect_thermal(second_half, confidence_threshold, channel="thermal")
    
    # Remap bounding boxes to full frame coordinates
    color_detections_remapped = remap_bounding_boxes(color_detections, layout, False, original_shape)
    thermal_detections_remapped = remap_bounding_boxes(thermal_detections, layout, True, original_shape)
    
    # Combine all detections
    all_detections = color_detections_remapped + thermal_detections_remapped
    
    return all_detections

def route_detection(image: np.ndarray, stream_type: StreamType, split_layout: Optional[SplitLayout], 
                   confidence_threshold: float) -> List[Detection]:
    """Route detection request to appropriate pipeline based on stream type."""
    if stream_type == StreamType.COLOR:
        return detect_color(image, confidence_threshold)
    elif stream_type == StreamType.THERMAL:
        return detect_thermal(image, confidence_threshold)
    elif stream_type == StreamType.SPLIT:
        if split_layout is None:
            logger.warning("Split layout not provided for SPLIT stream, defaulting to LEFT_RIGHT")
            split_layout = SplitLayout.LEFT_RIGHT
        return detect_split(image, split_layout, confidence_threshold)
    else:
        # Default to color detection
        logger.warning(f"Unknown stream type: {stream_type}, defaulting to color detection")
        return detect_color(image, confidence_threshold)

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
    request_data: Optional[DetectionRequest] = None,
    streamId: Optional[str] = None,
    enableDetection: Optional[bool] = None,
    confidenceThreshold: Optional[float] = None,
    streamType: Optional[str] = None,
    splitLayout: Optional[str] = None,
    channel: Optional[str] = None
):
    """
    Detect fire, smoke, or hotspots in an image.
    
    Supports both file upload and base64 encoded images.
    Accepts parameters via JSON body or form data.
    """
    global detection_stats
    
    # Build request data from form fields or JSON body
    if not request_data:
        request_data = DetectionRequest(
            streamId=streamId,
            enableDetection=enableDetection if enableDetection is not None else True,
            confidenceThreshold=confidenceThreshold,
            streamType=StreamType(streamType) if streamType else None,
            splitLayout=SplitLayout(splitLayout) if splitLayout else None,
            channel=channel
        )
    
    start_time = time.time()
    enabled = request_data.enableDetection and os.getenv("ENABLE_DETECTION", "true").lower() == "true"
    
    # Update stats
    update_stats(0, 0, enabled)  # Temporary stats update
    detection_stats["total_requests"] -= 1  # Correct the temporary increment
    
    model_info = {
        "name": "Multi-Model (Color/Thermal)",
        "color_path": color_model_path,
        "thermal_path": thermal_model_path,
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
        
        # Run inference based on stream type
        if is_warmed_up and (color_model is not None or thermal_model is not None):
            confidence_threshold = request_data.confidenceThreshold or float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
            
            # Determine stream type (default to COLOR for backward compatibility)
            stream_type = request_data.streamType or StreamType.COLOR
            split_layout = request_data.splitLayout
            
            # Route to appropriate detection pipeline
            detections = route_detection(image, stream_type, split_layout, confidence_threshold)
            
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