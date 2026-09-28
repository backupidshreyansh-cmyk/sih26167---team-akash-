import subprocess
import sys
from pathlib import Path
import json

def test_prepare_dataset_mock():
    scripts_dir = Path(__file__).resolve().parent.parent / "scripts"
    script_path = scripts_dir / "prepare_pilot_dataset.py"
    
    # Run the script with mock_if_missing flag since CI doesn't have the real LMDB
    result = subprocess.run(
        [sys.executable, str(script_path), "--mock_if_missing"],
        capture_output=True,
        text=True
    )
    
    # Check that it didn't crash
    assert result.returncode == 0, f"Script failed: {result.stderr}"
    
    # Verify the output files exist
    data_dir = Path(__file__).resolve().parent.parent / "data"
    jsonl_path = data_dir / "pilot_training.jsonl"
    report_path = data_dir / "pilot_dataset_report.json"
    
    assert jsonl_path.exists()
    assert report_path.exists()
    
    # Check report content
    with open(report_path, 'r') as f:
        report = json.load(f)
        
    assert report["unique_patches"] == 20
    assert report["s1_s2_records_complete"] == 20
    assert report["failures"] == 0
    assert report["is_mocked_run"] is True
    
    # Check JSONL
    with open(jsonl_path, 'r') as f:
        lines = f.readlines()
        assert len(lines) == 20
        first_record = json.loads(lines[0])
        assert first_record["id"] == "mock_patch_0"
        assert len(first_record["images"]) == 2
        assert "tensor_path" in first_record["images"][0]
        assert "tensor_path" in first_record["images"][1]
