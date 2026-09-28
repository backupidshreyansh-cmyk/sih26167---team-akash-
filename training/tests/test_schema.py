import pytest
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))
from src.schema import DatasetRecord, ImageRef

def test_valid_record():
    data = {
        "id": "test_001",
        "images": [{"path": "test.jpg", "modality": "optical"}],
        "task_type": "binary_vqa",
        "question": "Is there water?",
        "answer": "Yes.",
        "source": "Custom",
        "split": "train"
    }
    record = DatasetRecord(**data)
    assert record.id == "test_001"
    assert len(record.images) == 1
    assert record.images[0].modality == "optical"

def test_missing_image():
    data = {
        "id": "test_002",
        "images": [],
        "task_type": "binary_vqa",
        "question": "Is there water?",
        "answer": "Yes.",
        "source": "Custom",
        "split": "train"
    }
    with pytest.raises(ValueError, match="At least one image must be provided"):
        DatasetRecord(**data)

def test_invalid_modality():
    data = {
        "id": "test_003",
        "images": [{"path": "test.jpg", "modality": "x-ray"}],
        "task_type": "binary_vqa",
        "question": "Is there water?",
        "answer": "Yes.",
        "source": "Custom",
        "split": "train"
    }
    with pytest.raises(ValueError):
        DatasetRecord(**data)
