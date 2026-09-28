import pytest
import numpy as np
from src.bigearthnet_adapter import BigEarthNetLMDBAdapter
import json
import tempfile
from pathlib import Path

def test_s2_resizing_and_stacking():
    # We mock the LMDB/manifest and just test the deterministic resizing logic.
    # No real LMDB environment needed for testing the array manipulation logic.
    adapter = BigEarthNetLMDBAdapter.__new__(BigEarthNetLMDBAdapter)
    adapter.S2_BANDS = BigEarthNetLMDBAdapter.S2_BANDS
    
    mock_s2_data = {}
    
    # 10m bands (120x120)
    for b in ['B02', 'B03', 'B04', 'B08']:
        mock_s2_data[b] = np.ones((120, 120), dtype=np.uint16)
        
    # 20m bands (60x60)
    for b in ['B05', 'B06', 'B07', 'B8A', 'B11', 'B12']:
        mock_s2_data[b] = np.ones((60, 60), dtype=np.uint16) * 2
        
    # 60m bands (20x20)
    for b in ['B01', 'B09']:
        mock_s2_data[b] = np.ones((20, 20), dtype=np.uint16) * 3
        
    s2_tensor = adapter.process_s2_bands(mock_s2_data)
    
    assert s2_tensor.shape == (120, 120, 12)
    # Check if interpolation worked and preserved values
    # B01 is index 0 -> should be 3
    assert np.all(s2_tensor[:, :, 0] == 3)
    # B02 is index 1 -> should be 1
    assert np.all(s2_tensor[:, :, 1] == 1)
    # B05 is index 4 -> should be 2
    assert np.all(s2_tensor[:, :, 4] == 2)
    
def test_s1_stacking():
    adapter = BigEarthNetLMDBAdapter.__new__(BigEarthNetLMDBAdapter)
    adapter.S1_BANDS = BigEarthNetLMDBAdapter.S1_BANDS
    
    mock_s1_data = {
        'VV': np.ones((120, 120), dtype=np.float32),
        'VH': np.ones((120, 120), dtype=np.float32) * 2
    }
    
    s1_tensor = adapter.process_s1_bands(mock_s1_data)
    assert s1_tensor.shape == (120, 120, 2)
    assert np.all(s1_tensor[:, :, 0] == 1)
    assert np.all(s1_tensor[:, :, 1] == 2)

def test_vlm_compatible_conversion():
    adapter = BigEarthNetLMDBAdapter.__new__(BigEarthNetLMDBAdapter)
    
    s2_tensor = np.zeros((120, 120, 12), dtype=np.uint16)
    s1_tensor = np.zeros((120, 120, 2), dtype=np.float32)
    
    # Put max value in B04 (Red), index 3
    s2_tensor[:, :, 3] = 4000
    
    res = adapter.to_vlm_compatible(s2_tensor, s1_tensor)
    
    optical_rgb = np.array(res['optical_rgb'])
    sar_rgb = np.array(res['sar_rgb'])
    
    assert optical_rgb.shape == (120, 120, 3)
    assert sar_rgb.shape == (120, 120, 3)
    
    # Check that red channel is maxed out
    assert np.all(optical_rgb[:, :, 0] == 255)
    assert np.all(optical_rgb[:, :, 1] == 0)
    assert np.all(optical_rgb[:, :, 2] == 0)
