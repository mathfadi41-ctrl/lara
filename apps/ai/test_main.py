import pytest
import asyncio
import numpy as np
import base64
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
import io
from PIL import Image

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app

client = TestClient(app)

class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_endpoint_structure(self):
        """Test health endpoint returns correct structure."""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "modelLoaded" in data
        assert "version" in data
        assert "timestamp" in data
    
    @patch('main.is_warmed_up', False)
    def test_health_when_model_not_loaded(self):
        """Test health when model is not loaded."""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["modelLoaded"] is False
        assert data["status"] == "starting"

class TestDetectionEndpoint:
    """Test detection endpoint."""
    
    def create_test_image(self) -> bytes:
        """Create a test image in bytes format."""
        image = Image.new('RGB', (640, 480), color='red')
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        img_byte_arr.seek(0)
        return img_byte_arr.read()
    
    def create_test_base64_image(self) -> str:
        """Create a test image in base64 format."""
        image_bytes = self.create_test_image()
        return base64.b64encode(image_bytes).decode('utf-8')
    
    @patch('main.model')
    @patch('main.is_warmed_up', True)
    def test_detect_with_file_upload(self, mock_model):
        """Test detection with file upload."""
        # Mock model response
        mock_result = MagicMock()
        mock_result.boxes = MagicMock()
        mock_result.boxes.conf = [0.85]
        mock_result.boxes.xyxy = [np.array([100, 100, 300, 200])]
        mock_result.boxes.cls = [0]
        mock_result.names = {0: 'fire'}
        
        mock_model.return_value = [mock_result]
        
        test_image = self.create_test_image()
        
        response = client.post(
            "/detect",
            files={"file": ("test.jpg", test_image, "image/jpeg")},
            data={"streamId": "test_stream", "enableDetection": "true"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "detections" in data
        assert "inferenceTime" in data
        assert "modelInfo" in data
        assert "streamId" in data
        assert "enabled" in data
        
        assert data["streamId"] == "test_stream"
        assert data["enabled"] is True
        assert len(data["detections"]) > 0
    
    @patch('main.model')
    @patch('main.is_warmed_up', True)
    def test_detect_with_base64_image(self, mock_model):
        """Test detection with base64 encoded image."""
        # Mock model response
        mock_result = MagicMock()
        mock_result.boxes = MagicMock()
        mock_result.boxes.conf = [0.90]
        mock_result.boxes.xyxy = [np.array([50, 50, 250, 150])]
        mock_result.boxes.cls = [1]
        mock_result.names = {1: 'smoke'}
        
        mock_model.return_value = [mock_result]
        
        base64_image = self.create_test_base64_image()
        
        response = client.post(
            "/detect",
            json={
                "base64_image": base64_image,
                "streamId": "test_stream_2",
                "enableDetection": True,
                "confidenceThreshold": 0.5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["streamId"] == "test_stream_2"
        assert data["enabled"] is True
        assert len(data["detections"]) > 0
    
    def test_detect_without_image(self):
        """Test detection without image data."""
        response = client.post("/detect", json={})
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    @patch('main.is_warmed_up', False)
    def test_detect_when_model_not_ready(self):
        """Test detection when model is not ready."""
        test_image = self.create_test_image()
        
        response = client.post(
            "/detect",
            files={"file": ("test.jpg", test_image, "image/jpeg")}
        )
        
        assert response.status_code == 503
        data = response.json()
        assert "detail" in data
        assert "Model not loaded" in data["detail"]
    
    @patch('main.os.getenv')
    @patch('main.model')
    @patch('main.is_warmed_up', True)
    def test_detect_disabled_via_environment(self, mock_model, mock_getenv):
        """Test detection disabled via environment variable."""
        mock_getenv.return_value = "false"
        
        test_image = self.create_test_image()
        
        response = client.post(
            "/detect",
            files={"file": ("test.jpg", test_image, "image/jpeg")},
            data={"enableDetection": "true"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False
        assert len(data["detections"]) == 0
    
    @patch('main.model')
    @patch('main.is_warmed_up', True)
    def test_detect_with_custom_confidence_threshold(self, mock_model):
        """Test detection with custom confidence threshold."""
        # Mock model response - should filter out low confidence
        mock_result = MagicMock()
        mock_result.boxes = MagicMock()
        mock_result.boxes.conf = [0.85, 0.15, 0.95]  # Second one should be filtered
        mock_result.boxes.xyxy = [
            np.array([100, 100, 300, 200]),
            np.array([200, 200, 400, 300]),
            np.array([50, 50, 150, 150])
        ]
        mock_result.boxes.cls = [0, 1, 0]
        mock_result.names = {0: 'fire', 1: 'smoke'}
        
        mock_model.return_value = [mock_result]
        
        test_image = self.create_test_image()
        
        response = client.post(
            "/detect",
            files={"file": ("test.jpg", test_image, "image/jpeg")},
            data={"confidenceThreshold": "0.8"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only get 2 detections (0.85 and 0.95), filtering out 0.15
        assert len(data["detections"]) == 2
        for detection in data["detections"]:
            assert detection["confidence"] >= 0.8

class TestStatusEndpoint:
    """Test status endpoint."""
    
    @patch('main.psutil.virtual_memory')
    @patch('main.psutil.Process')
    @patch('main.torch.cuda.is_available', return_value=True)
    @patch('main.torch.cuda.get_device_name', return_value="Tesla T4")
    @patch('main.torch.cuda.memory_allocated', return_value=1024*1024*500)
    @patch('main.torch.cuda.get_device_properties')
    @patch('main.is_warmed_up', True)
    def test_status_endpoint_structure(self, mock_props, mock_memory, mock_process, mock_vmemory):
        """Test status endpoint returns correct structure."""
        # Mock GPU properties
        mock_device_props = MagicMock()
        mock_device_props.total_memory = 1024*1024*16000  # 16GB
        mock_props.return_value = mock_device_props
        
        # Mock memory info
        mock_vmemory.return_value = MagicMock()
        mock_vmemory.return_value.total = 16 * 1024 * 1024 * 1024  # 16GB
        mock_vmemory.return_value.available = 8 * 1024 * 1024 * 1024  # 8GB
        mock_vmemory.return_value.percent = 50.0
        
        mock_process.return_value.memory_info.return_value = MagicMock()
        mock_process.return_value.memory_info.return_value.rss = 1024*1024*200  # 200MB
        mock_process.return_value.memory_info.return_value.vms = 1024*1024*500  # 500MB
        
        response = client.get("/status")
        assert response.status_code == 200
        
        data = response.json()
        
        # Check all required fields
        required_fields = [
            "status", "modelLoaded", "device", "gpu", "fps", 
            "avgInferenceTime", "memoryUsage", "uptime", "stats"
        ]
        
        for field in required_fields:
            assert field in data
        
        assert data["modelLoaded"] is True
        assert data["gpu"] is not None
        assert "device" in data["gpu"]
        assert "memory_used" in data["gpu"]
        assert "memory_total" in data["gpu"]
    
    @patch('main.psutil.virtual_memory')
    @patch('main.psutil.Process')
    @patch('main.torch.cuda.is_available', return_value=False)
    @patch('main.is_warmed_up', True)
    def test_status_endpoint_no_gpu(self, mock_process, mock_vmemory):
        """Test status endpoint when no GPU is available."""
        # Mock memory info
        mock_vmemory.return_value = MagicMock()
        mock_vmemory.return_value.total = 8 * 1024 * 1024 * 1024  # 8GB
        mock_vmemory.return_value.available = 4 * 1024 * 1024 * 1024  # 4GB
        mock_vmemory.return_value.percent = 50.0
        
        mock_process.return_value.memory_info.return_value = MagicMock()
        mock_process.return_value.memory_info.return_value.rss = 1024*1024*100  # 100MB
        mock_process.return_value.memory_info.return_value.vms = 1024*1024*300  # 300MB
        
        response = client.get("/status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["gpu"] is None
        assert data["device"] == "cpu"

class TestImageProcessing:
    """Test image processing utilities."""
    
    def create_test_image_bytes(self) -> bytes:
        """Create test image in bytes format."""
        image = Image.new('RGB', (320, 240), color='blue')
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        return img_byte_arr.getvalue()
    
    def test_process_image(self):
        """Test image processing function."""
        image_bytes = self.create_test_image_bytes()
        
        from main import process_image
        
        # Should not raise exception
        result = process_image(image_bytes)
        
        assert isinstance(result, np.ndarray)
        assert len(result.shape) == 3  # Height, Width, Channels
        assert result.shape[2] == 3  # BGR channels
    
    def test_process_base64_image(self):
        """Test base64 image processing function."""
        image_bytes = self.create_test_image_bytes()
        base64_string = base64.b64encode(image_bytes).decode('utf-8')
        
        from main import process_base64_image
        
        # Should not raise exception
        result = process_base64_image(base64_string)
        
        assert isinstance(result, np.ndarray)
        assert len(result.shape) == 3

class TestStatistics:
    """Test statistics tracking."""
    
    def test_update_stats(self):
        """Test statistics update function."""
        from main import detection_stats, inference_times, update_stats
        
        # Store initial values
        initial_requests = detection_stats["total_requests"]
        initial_detections = detection_stats["total_detections"]
        initial_times_count = len(inference_times)
        
        # Update stats
        update_stats(0.1, 3, True)
        
        assert detection_stats["total_requests"] == initial_requests + 1
        assert detection_stats["detection_enabled_requests"] == initial_requests + 1
        assert detection_stats["total_detections"] == initial_detections + 3
        assert len(inference_times) == initial_times_count + 1
        assert inference_times[-1] == 0.1
    
    def test_update_stats_disabled(self):
        """Test statistics update when detection is disabled."""
        from main import detection_stats, inference_times, update_stats
        
        # Store initial values
        initial_requests = detection_stats["total_requests"]
        initial_enabled = detection_stats["detection_enabled_requests"]
        initial_times_count = len(inference_times)
        
        # Update stats with detection disabled
        update_stats(0.1, 3, False)
        
        assert detection_stats["total_requests"] == initial_requests + 1
        assert detection_stats["detection_enabled_requests"] == initial_enabled  # Should not change
        assert detection_stats["total_detections"] == initial_times_count  # Should not change
        assert len(inference_times) == initial_times_count  # Should not change

class TestModelManagement:
    """Test model loading and management."""
    
    @patch('main.os.path.exists')
    @patch('main.YOLO')
    @patch('main.device', None)
    def test_load_model_success(self, mock_yolo, mock_exists):
        """Test successful model loading."""
        mock_exists.return_value = True
        
        mock_model_instance = MagicMock()
        mock_yolo.return_value = mock_model_instance
        
        from main import load_model
        
        result = load_model()
        
        assert result is True
        mock_yolo.assert_called_once()
        mock_model_instance.to.assert_called_once()
    
    @patch('main.logger')
    @patch('main.YOLO')
    @patch('main.os.path.exists')
    @patch('main.device', None)
    def test_load_model_failure(self, mock_yolo, mock_exists, mock_logger):
        """Test model loading failure."""
        mock_exists.return_value = True
        mock_yolo.side_effect = Exception("Model loading failed")
        
        from main import load_model
        
        result = load_model()
        
        assert result is False
        mock_logger.error.assert_called_once()

# Integration tests
class TestIntegration:
    """Integration tests for the complete service."""
    
    @patch('main.model')
    @patch('main.is_warmed_up', True)
    def test_complete_detection_workflow(self, mock_model):
        """Test complete detection workflow."""
        # Mock model response
        mock_result = MagicMock()
        mock_result.boxes = MagicMock()
        mock_result.boxes.conf = [0.87]
        mock_result.boxes.xyxy = [np.array([120, 120, 280, 220])]
        mock_result.boxes.cls = [2]
        mock_result.names = {2: 'hotspot'}
        
        mock_model.return_value = [mock_result]
        
        # Create test image
        image = Image.new('RGB', (400, 300), color='orange')
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')
        image_bytes = img_byte_arr.getvalue()
        
        # Test health check
        health_response = client.get("/health")
        assert health_response.status_code == 200
        
        # Test detection
        detection_response = client.post(
            "/detect",
            files={"file": ("test.jpg", image_bytes, "image/jpeg")},
            data={
                "streamId": "integration_test",
                "enableDetection": "true",
                "confidenceThreshold": "0.5"
            }
        )
        
        assert detection_response.status_code == 200
        detection_data = detection_response.json()
        
        # Test status
        status_response = client.get("/status")
        assert status_response.status_code == 200
        
        status_data = status_response.json()
        
        # Verify complete workflow
        health_data = health_response.json()
        assert health_data["modelLoaded"] is True
        
        assert detection_data["enabled"] is True
        assert len(detection_data["detections"]) > 0
        
        assert status_data["modelLoaded"] is True
        assert status_data["stats"]["total_requests"] > 0

if __name__ == "__main__":
    pytest.main([__file__])