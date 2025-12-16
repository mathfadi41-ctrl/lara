import pytest
import numpy as np
from unittest.mock import Mock, patch, MagicMock
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import (
    StreamType, SplitLayout, DetectionType,
    split_frame, remap_bounding_boxes,
    route_detection, detect_color, detect_thermal, detect_split,
    ThermalDetector, Detection, BoundingBox,
    map_label_to_detection_type
)


class TestStreamTypeRouting:
    """Test routing logic for different stream types."""
    
    @patch('main.color_model')
    def test_route_color_stream(self, mock_color_model):
        """Test routing COLOR stream to color detector."""
        # Create mock image
        image = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Mock YOLO model response
        mock_result = MagicMock()
        mock_result.boxes = MagicMock()
        mock_result.boxes.conf = [0.85]
        mock_result.boxes.xyxy = [np.array([100, 100, 300, 200])]
        mock_result.boxes.cls = [0]
        mock_result.names = {0: 'fire'}
        mock_color_model.return_value = [mock_result]
        
        # Route detection
        detections = route_detection(image, StreamType.COLOR, None, 0.5)
        
        # Verify
        assert len(detections) == 1
        assert detections[0].label == 'fire'
        assert detections[0].detectionType == DetectionType.FIRE
        assert detections[0].channel is None
    
    @patch('main.thermal_model')
    def test_route_thermal_stream(self, mock_thermal_model):
        """Test routing THERMAL stream to thermal detector."""
        # Create mock thermal image (bright spots for hotspots)
        image = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Mock thermal detector
        mock_thermal_model.detect = MagicMock(return_value=[
            Detection(
                label="hotspot",
                confidence=0.9,
                boundingBox=BoundingBox(x=200, y=150, width=50, height=50),
                detectionType=DetectionType.HOTSPOT,
                channel=None
            )
        ])
        
        # Route detection
        detections = route_detection(image, StreamType.THERMAL, None, 0.5)
        
        # Verify
        assert len(detections) == 1
        assert detections[0].label == 'hotspot'
        assert detections[0].detectionType == DetectionType.HOTSPOT
    
    @patch('main.thermal_model')
    @patch('main.color_model')
    def test_route_split_stream(self, mock_color_model, mock_thermal_model):
        """Test routing SPLIT stream to both detectors."""
        # Create mock split image
        image = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Mock color model
        mock_color_result = MagicMock()
        mock_color_result.boxes = MagicMock()
        mock_color_result.boxes.conf = [0.85]
        mock_color_result.boxes.xyxy = [np.array([50, 50, 150, 150])]
        mock_color_result.boxes.cls = [0]
        mock_color_result.names = {0: 'smoke'}
        mock_color_model.return_value = [mock_color_result]
        
        # Mock thermal detector
        mock_thermal_model.detect = MagicMock(return_value=[
            Detection(
                label="hotspot",
                confidence=0.9,
                boundingBox=BoundingBox(x=100, y=100, width=50, height=50),
                detectionType=DetectionType.HOTSPOT,
                channel=None
            )
        ])
        
        # Route detection with LEFT_RIGHT layout
        detections = route_detection(image, StreamType.SPLIT, SplitLayout.LEFT_RIGHT, 0.5)
        
        # Verify we get detections from both channels
        assert len(detections) >= 1  # At least one detection
        
        # Check for channel tags
        channels = [d.channel for d in detections if d.channel]
        assert 'color' in channels or 'thermal' in channels


class TestFrameSplitting:
    """Test frame splitting logic."""
    
    def test_split_left_right(self):
        """Test LEFT_RIGHT split layout."""
        # Create test image 640x480
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        left, right = split_frame(image, SplitLayout.LEFT_RIGHT)
        
        # Verify dimensions
        assert left.shape == (480, 320, 3)
        assert right.shape == (480, 320, 3)
        
        # Verify split is correct
        np.testing.assert_array_equal(left, image[:, :320])
        np.testing.assert_array_equal(right, image[:, 320:])
    
    def test_split_top_bottom(self):
        """Test TOP_BOTTOM split layout."""
        # Create test image 640x480
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        top, bottom = split_frame(image, SplitLayout.TOP_BOTTOM)
        
        # Verify dimensions
        assert top.shape == (240, 640, 3)
        assert bottom.shape == (240, 640, 3)
        
        # Verify split is correct
        np.testing.assert_array_equal(top, image[:240, :])
        np.testing.assert_array_equal(bottom, image[240:, :])


class TestBoundingBoxRemapping:
    """Test bounding box remapping for split frames."""
    
    def test_remap_left_right_first_half(self):
        """Test remapping bounding boxes from left half."""
        original_shape = (480, 640, 3)
        
        # Create detection in left half (0 to 320)
        detection = Detection(
            label="smoke",
            confidence=0.8,
            boundingBox=BoundingBox(x=100, y=150, width=50, height=60),
            detectionType=DetectionType.SMOKE,
            channel="color"
        )
        
        remapped = remap_bounding_boxes([detection], SplitLayout.LEFT_RIGHT, False, original_shape)
        
        # First half should have no offset
        assert remapped[0].boundingBox.x == 100
        assert remapped[0].boundingBox.y == 150
        assert remapped[0].boundingBox.width == 50
        assert remapped[0].boundingBox.height == 60
    
    def test_remap_left_right_second_half(self):
        """Test remapping bounding boxes from right half."""
        original_shape = (480, 640, 3)
        
        # Create detection in right half coordinate system (0 to 320)
        detection = Detection(
            label="hotspot",
            confidence=0.9,
            boundingBox=BoundingBox(x=100, y=150, width=50, height=60),
            detectionType=DetectionType.HOTSPOT,
            channel="thermal"
        )
        
        remapped = remap_bounding_boxes([detection], SplitLayout.LEFT_RIGHT, True, original_shape)
        
        # Second half should add 320 to x
        assert remapped[0].boundingBox.x == 420  # 100 + 320
        assert remapped[0].boundingBox.y == 150
        assert remapped[0].boundingBox.width == 50
        assert remapped[0].boundingBox.height == 60
    
    def test_remap_top_bottom_first_half(self):
        """Test remapping bounding boxes from top half."""
        original_shape = (480, 640, 3)
        
        detection = Detection(
            label="fire",
            confidence=0.85,
            boundingBox=BoundingBox(x=200, y=100, width=80, height=70),
            detectionType=DetectionType.FIRE,
            channel="color"
        )
        
        remapped = remap_bounding_boxes([detection], SplitLayout.TOP_BOTTOM, False, original_shape)
        
        # First half should have no offset
        assert remapped[0].boundingBox.x == 200
        assert remapped[0].boundingBox.y == 100
    
    def test_remap_top_bottom_second_half(self):
        """Test remapping bounding boxes from bottom half."""
        original_shape = (480, 640, 3)
        
        detection = Detection(
            label="hotspot",
            confidence=0.92,
            boundingBox=BoundingBox(x=200, y=100, width=80, height=70),
            detectionType=DetectionType.HOTSPOT,
            channel="thermal"
        )
        
        remapped = remap_bounding_boxes([detection], SplitLayout.TOP_BOTTOM, True, original_shape)
        
        # Second half should add 240 to y
        assert remapped[0].boundingBox.x == 200
        assert remapped[0].boundingBox.y == 340  # 100 + 240


class TestThermalDetector:
    """Test thermal hotspot detector."""
    
    def test_thermal_detector_initialization(self):
        """Test thermal detector initialization."""
        detector = ThermalDetector(threshold=180.0)
        assert detector.threshold == 180.0
    
    def test_thermal_detector_no_hotspots(self):
        """Test thermal detector with no hotspots (dark image)."""
        detector = ThermalDetector(threshold=200.0)
        
        # Create dark image (no hotspots)
        image = np.zeros((480, 640, 3), dtype=np.uint8)
        
        detections = detector.detect(image, confidence_threshold=0.5)
        
        # Should find no hotspots
        assert len(detections) == 0
    
    def test_thermal_detector_with_hotspot(self):
        """Test thermal detector with bright hotspot."""
        detector = ThermalDetector(threshold=200.0)
        
        # Create image with bright spot
        image = np.zeros((480, 640, 3), dtype=np.uint8)
        image[200:300, 300:400] = 255  # Bright hotspot region
        
        detections = detector.detect(image, confidence_threshold=0.5)
        
        # Should find at least one hotspot
        assert len(detections) > 0
        assert detections[0].detectionType == DetectionType.HOTSPOT
        assert detections[0].label == "hotspot"
        
        # Check bounding box is in the right region
        bbox = detections[0].boundingBox
        assert 200 <= bbox.y <= 300
        assert 300 <= bbox.x <= 400
    
    def test_thermal_detector_grayscale_input(self):
        """Test thermal detector with grayscale input."""
        detector = ThermalDetector(threshold=200.0)
        
        # Create grayscale image with hotspot
        image = np.zeros((480, 640), dtype=np.uint8)
        image[150:200, 250:300] = 255
        
        detections = detector.detect(image, confidence_threshold=0.5)
        
        # Should handle grayscale correctly
        assert len(detections) > 0


class TestLabelMapping:
    """Test label to detection type mapping."""
    
    def test_map_fire_label(self):
        """Test mapping fire-related labels."""
        assert map_label_to_detection_type("fire") == DetectionType.FIRE
        assert map_label_to_detection_type("Fire") == DetectionType.FIRE
        assert map_label_to_detection_type("wildfire") == DetectionType.FIRE
    
    def test_map_smoke_label(self):
        """Test mapping smoke-related labels."""
        assert map_label_to_detection_type("smoke") == DetectionType.SMOKE
        assert map_label_to_detection_type("Smoke") == DetectionType.SMOKE
        assert map_label_to_detection_type("smoke_detector") == DetectionType.SMOKE
    
    def test_map_hotspot_label(self):
        """Test mapping hotspot-related labels."""
        assert map_label_to_detection_type("hotspot") == DetectionType.HOTSPOT
        assert map_label_to_detection_type("hot") == DetectionType.HOTSPOT
        assert map_label_to_detection_type("hotzone") == DetectionType.HOTSPOT
    
    def test_map_unknown_label(self):
        """Test mapping unknown labels defaults to SMOKE."""
        assert map_label_to_detection_type("person") == DetectionType.SMOKE
        assert map_label_to_detection_type("car") == DetectionType.SMOKE


class TestSplitDetectionIntegration:
    """Integration tests for split stream detection."""
    
    @patch('main.thermal_model')
    @patch('main.color_model')
    def test_split_detection_combines_results(self, mock_color_model, mock_thermal_model):
        """Test that split detection combines results from both pipelines."""
        # Create 640x480 test image
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Mock color detection (left half)
        mock_color_result = MagicMock()
        mock_color_result.boxes = MagicMock()
        mock_color_result.boxes.conf = [0.8, 0.75]
        mock_color_result.boxes.xyxy = [
            np.array([50, 100, 150, 200]),
            np.array([100, 150, 200, 250])
        ]
        mock_color_result.boxes.cls = [0, 1]
        mock_color_result.names = {0: 'fire', 1: 'smoke'}
        mock_color_model.return_value = [mock_color_result]
        
        # Mock thermal detection (right half)
        mock_thermal_model.detect = MagicMock(return_value=[
            Detection(
                label="hotspot",
                confidence=0.9,
                boundingBox=BoundingBox(x=100, y=200, width=80, height=80),
                detectionType=DetectionType.HOTSPOT,
                channel=None
            )
        ])
        
        # Run split detection
        detections = detect_split(image, SplitLayout.LEFT_RIGHT, 0.5)
        
        # Should have detections from both channels
        assert len(detections) >= 2
        
        # Check channel tags
        color_detections = [d for d in detections if d.channel == "color"]
        thermal_detections = [d for d in detections if d.channel == "thermal"]
        
        assert len(color_detections) >= 1
        assert len(thermal_detections) >= 1
        
        # Check bounding box remapping for thermal (should be offset by 320)
        for det in thermal_detections:
            assert det.boundingBox.x >= 320  # Should be in right half
    
    @patch('main.thermal_model')
    @patch('main.color_model')
    def test_split_detection_top_bottom(self, mock_color_model, mock_thermal_model):
        """Test split detection with TOP_BOTTOM layout."""
        # Create 480x640 test image
        image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Mock color detection (top half)
        mock_color_result = MagicMock()
        mock_color_result.boxes = MagicMock()
        mock_color_result.boxes.conf = [0.85]
        mock_color_result.boxes.xyxy = [np.array([100, 50, 200, 150])]
        mock_color_result.boxes.cls = [0]
        mock_color_result.names = {0: 'smoke'}
        mock_color_model.return_value = [mock_color_result]
        
        # Mock thermal detection (bottom half)
        mock_thermal_model.detect = MagicMock(return_value=[
            Detection(
                label="hotspot",
                confidence=0.88,
                boundingBox=BoundingBox(x=150, y=100, width=60, height=60),
                detectionType=DetectionType.HOTSPOT,
                channel=None
            )
        ])
        
        # Run split detection
        detections = detect_split(image, SplitLayout.TOP_BOTTOM, 0.5)
        
        # Should have detections from both channels
        thermal_detections = [d for d in detections if d.channel == "thermal"]
        
        # Check bounding box remapping for thermal (y should be offset by 240)
        for det in thermal_detections:
            assert det.boundingBox.y >= 240  # Should be in bottom half


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
