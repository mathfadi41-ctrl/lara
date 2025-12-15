import os
import io
import time
import logging
import base64
import grpc
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional

import numpy as np
import cv2
from PIL import Image
import torch
from ultralytics import YOLO

# Import generated proto files (will be created from .proto)
# Note: In production, these would be generated using protoc
# from proto import fire_detection_pb2
# from proto import fire_detection_pb2_grpc

logger = logging.getLogger(__name__)

# Global variables (shared with FastAPI version)
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
        raise

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
        raise

def format_detections(results, confidence_threshold: float = 0.25):
    """Format YOLO results into protobuf detection objects."""
    # This function would return protobuf message objects
    # For now, return placeholder data structure
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
                
                # In real implementation, create protobuf message:
                # detection = fire_detection_pb2.Detection()
                # detection.label = label
                # detection.confidence = confidence
                # detection.bounding_box.x = x1
                # detection.bounding_box.y = y1
                # detection.bounding_box.width = x2 - x1
                # detection.bounding_box.height = y2 - y1
                # detections.append(detection)
                
                # For now, return dict representation
                detections.append({
                    "label": label,
                    "confidence": confidence,
                    "bounding_box": {
                        "x": x1,
                        "y": y1,
                        "width": x2 - x1,
                        "height": y2 - y1
                    }
                })
    
    return detections

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

class FireDetectionServicer:
    """gRPC servicer for fire detection service."""
    
    def DetectFire(self, request, context):
        """Handle fire detection requests."""
        start_time = time.time()
        enabled = request.enable_detection and os.getenv("ENABLE_DETECTION", "true").lower() == "true"
        
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
            
            # Return empty response
            return {
                "detections": [],
                "inference_time": inference_time,
                "model_info": model_info,
                "stream_id": request.stream_id,
                "enabled": False
            }
        
        try:
            # Process image
            if request.image_bytes:
                image = process_image(request.image_bytes)
            elif request.base64_image:
                image = process_base64_image(request.base64_image)
            else:
                context.set_code(grpc.StatusCode.INVALID_ARGUMENT)
                context.set_detail("Either image_bytes or base64_image must be provided")
                return {}
            
            # Run inference
            if is_warmed_up and model is not None:
                confidence_threshold = request.confidence_threshold or float(os.getenv("CONFIDENCE_THRESHOLD", "0.25"))
                results = model(image, conf=confidence_threshold, verbose=False)
                detections = format_detections(results, confidence_threshold)
            else:
                context.set_code(grpc.StatusCode.UNAVAILABLE)
                context.set_detail("Model not loaded or warmed up")
                return {}
            
            inference_time = time.time() - start_time
            update_stats(inference_time, len(detections), enabled)
            
            return {
                "detections": detections,
                "inference_time": inference_time,
                "model_info": model_info,
                "stream_id": request.stream_id,
                "enabled": True
            }
            
        except Exception as e:
            logger.error(f"Error during detection: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_detail(f"Detection failed: {e}")
            return {}
    
    def GetStatus(self, request, context):
        """Get service status and performance metrics."""
        uptime = time.time() - startup_time
        
        try:
            import psutil
            memory = psutil.virtual_memory()
            process = psutil.Process()
            process_memory = process.memory_info()
            
            # Get GPU info
            gpu_info = None
            if torch.cuda.is_available():
                gpu_info = {
                    "device": torch.cuda.get_device_name(),
                    "memory_used": torch.cuda.memory_allocated(),
                    "memory_total": torch.cuda.get_device_properties(0).total_memory,
                    "compute_capability": torch.cuda.get_device_capability(),
                }
            
            return {
                "status": "running" if is_warmed_up else "starting",
                "model_loaded": is_warmed_up,
                "device": get_device_info(),
                "gpu": gpu_info,
                "fps": detection_stats["fps"],
                "avg_inference_time": detection_stats["avg_inference_time"],
                "memory_usage": {
                    "total": memory.total,
                    "available": memory.available,
                    "percent": memory.percent,
                    "process_rss": process_memory.rss,
                    "process_vms": process_memory.vms,
                },
                "uptime": uptime,
                "stats": detection_stats
            }
        except Exception as e:
            logger.error(f"Error getting status: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_detail(f"Status check failed: {e}")
            return {}
    
    def HealthCheck(self, request, context):
        """Health check endpoint."""
        return {
            "status": "healthy" if is_warmed_up else "starting",
            "model_loaded": is_warmed_up,
            "version": "1.0.0",
            "timestamp": time.time()
        }

def serve_grpc(max_workers: int = 10):
    """Start gRPC server."""
    port = os.getenv("GRPC_PORT", "50051")
    
    server = grpc.server(ThreadPoolExecutor(max_workers=max_workers))
    # FireDetectionServicer would be registered here in real implementation
    # fire_detection_pb2_grpc.add_FireDetectionServiceServicer_to_server(
    #     FireDetectionServicer(), server
    # )
    
    server.add_insecure_port(f"[::]:{port}")
    server.start()
    
    logger.info(f"gRPC server started on port {port}")
    return server

if __name__ == "__main__":
    import uvicorn
    
    # Load model
    if load_model():
        logger.info("Model loaded successfully for gRPC server")
    else:
        logger.error("Failed to load model for gRPC server")
    
    # Start gRPC server
    grpc_server = serve_grpc()
    
    try:
        grpc_server.wait_for_termination()
    except KeyboardInterrupt:
        grpc_server.stop(0)
        logger.info("gRPC server stopped")