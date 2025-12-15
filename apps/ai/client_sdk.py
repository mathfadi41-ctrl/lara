#!/usr/bin/env python3
"""
Client SDK for Fire/Smoke Detection AI Service

This script demonstrates how to use the AI service via both HTTP/REST and gRPC.
"""

import os
import sys
import time
import base64
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path

import requests
import grpc
import numpy as np
from PIL import Image
import cv2

# For gRPC (would require generated proto files)
# import fire_detection_pb2
# import fire_detection_pb2_grpc

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FireDetectionClient:
    """Client for Fire/Smoke Detection AI Service."""
    
    def __init__(self, base_url: str = "http://localhost:8000", grpc_channel: str = "localhost:50051"):
        """
        Initialize client with service URLs.
        
        Args:
            base_url: Base URL for HTTP REST API
            grpc_channel: gRPC server address
        """
        self.base_url = base_url.rstrip('/')
        self.grpc_channel = grpc_channel
        self.session = requests.Session()
        
        # Configure session
        self.session.headers.update({
            'User-Agent': 'FireDetectionClient/1.0',
            'Content-Type': 'application/json'
        })
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check service health.
        
        Returns:
            Health status information
        """
        try:
            response = self.session.get(f"{self.base_url}/health")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            raise
    
    def get_status(self) -> Dict[str, Any]:
        """
        Get service status and performance metrics.
        
        Returns:
            Service status information
        """
        try:
            response = self.session.get(f"{self.base_url}/status")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Status check failed: {e}")
            raise
    
    def detect_from_file(self, 
                        image_path: str,
                        stream_id: Optional[str] = None,
                        enable_detection: bool = True,
                        confidence_threshold: Optional[float] = None) -> Dict[str, Any]:
        """
        Detect fire/smoke in an image file.
        
        Args:
            image_path: Path to image file
            stream_id: Optional stream identifier
            enable_detection: Enable/disable detection for this request
            confidence_threshold: Optional confidence threshold override
            
        Returns:
            Detection results
        """
        try:
            # Read and encode image
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            return self.detect_from_bytes(
                image_data=image_data,
                stream_id=stream_id,
                enable_detection=enable_detection,
                confidence_threshold=confidence_threshold
            )
            
        except Exception as e:
            logger.error(f"Detection from file failed: {e}")
            raise
    
    def detect_from_bytes(self, 
                         image_data: bytes,
                         stream_id: Optional[str] = None,
                         enable_detection: bool = True,
                         confidence_threshold: Optional[float] = None) -> Dict[str, Any]:
        """
        Detect fire/smoke in image bytes.
        
        Args:
            image_data: Raw image bytes
            stream_id: Optional stream identifier
            enable_detection: Enable/disable detection for this request
            confidence_threshold: Optional confidence threshold override
            
        Returns:
            Detection results
        """
        try:
            # Prepare detection request
            detection_request = {
                "streamId": stream_id,
                "enableDetection": enable_detection,
            }
            
            if confidence_threshold is not None:
                detection_request["confidenceThreshold"] = confidence_threshold
            
            # Send request with multipart form data
            files = {'file': ('image.jpg', image_data, 'image/jpeg')}
            data = detection_request
            
            response = self.session.post(
                f"{self.base_url}/detect",
                files=files,
                data=data
            )
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Detection from bytes failed: {e}")
            raise
    
    def detect_from_base64(self, 
                          base64_image: str,
                          stream_id: Optional[str] = None,
                          enable_detection: bool = True,
                          confidence_threshold: Optional[float] = None) -> Dict[str, Any]:
        """
        Detect fire/smoke in base64 encoded image.
        
        Args:
            base64_image: Base64 encoded image data
            stream_id: Optional stream identifier
            enable_detection: Enable/disable detection for this request
            confidence_threshold: Optional confidence threshold override
            
        Returns:
            Detection results
        """
        try:
            # Prepare detection request
            detection_request = {
                "streamId": stream_id,
                "enableDetection": enable_detection,
                "base64_image": base64_image
            }
            
            if confidence_threshold is not None:
                detection_request["confidenceThreshold"] = confidence_threshold
            
            response = self.session.post(
                f"{self.base_url}/detect",
                json=detection_request
            )
            response.raise_for_status()
            return response.json()
            
        except Exception as e:
            logger.error(f"Detection from base64 failed: {e}")
            raise
    
    def detect_from_numpy(self, 
                         image_array: np.ndarray,
                         stream_id: Optional[str] = None,
                         enable_detection: bool = True,
                         confidence_threshold: Optional[float] = None) -> Dict[str, Any]:
        """
        Detect fire/smoke in numpy image array.
        
        Args:
            image_array: NumPy image array (BGR format)
            stream_id: Optional stream identifier
            enable_detection: Enable/disable detection for this request
            confidence_threshold: Optional confidence threshold override
            
        Returns:
            Detection results
        """
        try:
            # Convert numpy array to JPEG bytes
            _, buffer = cv2.imencode('.jpg', image_array)
            image_data = buffer.tobytes()
            
            return self.detect_from_bytes(
                image_data=image_data,
                stream_id=stream_id,
                enable_detection=enable_detection,
                confidence_threshold=confidence_threshold
            )
            
        except Exception as e:
            logger.error(f"Detection from numpy array failed: {e}")
            raise
    
    def batch_detect(self, 
                    image_paths: List[str],
                    stream_id_prefix: str = "batch",
                    enable_detection: bool = True,
                    confidence_threshold: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Detect fire/smoke in multiple images.
        
        Args:
            image_paths: List of paths to image files
            stream_id_prefix: Prefix for stream IDs
            enable_detection: Enable/disable detection for this request
            confidence_threshold: Optional confidence threshold override
            
        Returns:
            List of detection results
        """
        results = []
        
        for i, image_path in enumerate(image_paths):
            try:
                stream_id = f"{stream_id_prefix}_{i}"
                result = self.detect_from_file(
                    image_path=image_path,
                    stream_id=stream_id,
                    enable_detection=enable_detection,
                    confidence_threshold=confidence_threshold
                )
                results.append(result)
                
                logger.info(f"Processed {image_path}: {len(result['detections'])} detections")
                
            except Exception as e:
                logger.error(f"Failed to process {image_path}: {e}")
                results.append({
                    "error": str(e),
                    "image_path": image_path,
                    "detections": []
                })
        
        return results
    
    def draw_detections(self, image_array: np.ndarray, detections: List[Dict[str, Any]]) -> np.ndarray:
        """
        Draw detection bounding boxes on image.
        
        Args:
            image_array: NumPy image array (BGR format)
            detections: Detection results from detect endpoint
            
        Returns:
            Image with drawn detections
        """
        result_image = image_array.copy()
        
        for detection in detections['detections']:
            bbox = detection['boundingBox']
            confidence = detection['confidence']
            label = detection['label']
            
            # Draw bounding box
            cv2.rectangle(
                result_image,
                (bbox['x'], bbox['y']),
                (bbox['x'] + bbox['width'], bbox['y'] + bbox['height']),
                (0, 255, 0),  # Green
                2
            )
            
            # Draw label
            label_text = f"{label}: {confidence:.2f}"
            cv2.putText(
                result_image,
                label_text,
                (bbox['x'], bbox['y'] - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                2
            )
        
        return result_image

# Example usage and testing functions
def main():
    """Example usage of the Fire Detection Client."""
    
    # Initialize client
    client = FireDetectionClient()
    
    try:
        # Check health
        logger.info("Checking service health...")
        health = client.health_check()
        logger.info(f"Health: {health}")
        
        # Get status
        logger.info("Getting service status...")
        status = client.get_status()
        logger.info(f"Status: {status}")
        
        # Create a test image if none provided
        test_image_path = "test_image.jpg"
        if len(sys.argv) > 1:
            test_image_path = sys.argv[1]
        elif not os.path.exists(test_image_path):
            logger.info("Creating test image...")
            test_image = np.zeros((480, 640, 3), dtype=np.uint8)
            test_image[:] = (50, 100, 150)  # Blue-ish background
            cv2.putText(test_image, "Test Image", (200, 240), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            cv2.imwrite(test_image_path, test_image)
            logger.info(f"Created test image: {test_image_path}")
        
        # Run detection
        logger.info(f"Running detection on {test_image_path}...")
        result = client.detect_from_file(
            image_path=test_image_path,
            stream_id="test_stream_001",
            enable_detection=True,
            confidence_threshold=0.3
        )
        
        logger.info(f"Detection result: {result}")
        
        # Visualize results
        if result['detections']:
            logger.info(f"Found {len(result['detections'])} detections")
            image = cv2.imread(test_image_path)
            result_image = client.draw_detections(image, result)
            
            output_path = "detection_result.jpg"
            cv2.imwrite(output_path, result_image)
            logger.info(f"Result saved to {output_path}")
        else:
            logger.info("No detections found")
        
    except Exception as e:
        logger.error(f"Example failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()