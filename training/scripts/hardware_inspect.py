import psutil
import platform
import json
import os
import sys

def get_size(bytes, suffix="B"):
    factor = 1024
    for unit in ["", "K", "M", "G", "T", "P"]:
        if bytes < factor:
            return f"{bytes:.2f}{unit}{suffix}"
        bytes /= factor

def inspect_hardware():
    hardware_info = {
        "system": platform.system(),
        "release": platform.release(),
        "cpu_count_logical": psutil.cpu_count(logical=True),
        "cpu_count_physical": psutil.cpu_count(logical=False),
        "ram_total": get_size(psutil.virtual_memory().total),
        "ram_available": get_size(psutil.virtual_memory().available),
        "disk_free": get_size(psutil.disk_usage('/').free),
        "gpu": [],
        "cuda_available": False,
        "pytorch_version": None,
        "cuda_version": None,
        "recommended_mode": "NOT SUITABLE"
    }

    try:
        import torch
        hardware_info["pytorch_version"] = torch.__version__
        hardware_info["cuda_available"] = torch.cuda.is_available()
        
        vram_total_gb = 0
        if hardware_info["cuda_available"]:
            hardware_info["cuda_version"] = torch.version.cuda
            for i in range(torch.cuda.device_count()):
                props = torch.cuda.get_device_properties(i)
                vram = props.total_memory
                vram_total_gb += vram / (1024**3)
                hardware_info["gpu"].append({
                    "id": i,
                    "name": props.name,
                    "vram_total": get_size(vram),
                    "compute_capability": f"{props.major}.{props.minor}"
                })
            
            # Strict safety decision based on RTX 4050 6GB requirements
            if 5.0 <= vram_total_gb <= 7.0:
                hardware_info["recommended_mode"] = "SAFE LOCAL PILOT"
            elif vram_total_gb > 7.0:
                hardware_info["recommended_mode"] = "SUITABLE"
    except ImportError:
        pass
        
    print("="*50)
    print("HARDWARE INSPECTION & SAFETY REPORT")
    print("="*50)
    print(f"OS: {hardware_info['system']} {hardware_info['release']}")
    print(f"CPU: {hardware_info['cpu_count_physical']} physical / {hardware_info['cpu_count_logical']} logical")
    print(f"RAM: {hardware_info['ram_available']} available / {hardware_info['ram_total']} total")
    print(f"PyTorch: {hardware_info['pytorch_version']}")
    
    if not hardware_info['cuda_available']:
        print("\nGPU: NOT DETECTED (or CUDA unavailable)")
        print("\nRecommended mode: NOT SUITABLE")
        print("CPU training: NOT RECOMMENDED (Extremely slow and may crash)")
        print("WARNING: This pipeline requires a CUDA-capable GPU.")
    else:
        print(f"CUDA Version: {hardware_info['cuda_version']}")
        for gpu in hardware_info['gpu']:
            print(f"GPU {gpu['id']}: {gpu['name']} ({gpu['vram_total']} VRAM)")
        
        print("\nRECOMMENDATION:")
        print(f"Recommended mode: {hardware_info['recommended_mode']}")
        
        if hardware_info["recommended_mode"] == "SAFE LOCAL PILOT":
            print("Full Qwen3-VL-4B LoRA: NOT ASSUMED SAFE/FEASIBLE WITHOUT TESTING")
            print("CPU training: NOT RECOMMENDED")
            print("\n[HARDWARE SAFETY NOTICE]")
            print("- Your GPU has ~6 GB of VRAM, which is heavily constrained for a 4B parameter multimodal model.")
            print("- You MUST use the `safe_rtx4050_6gb.yaml` configuration.")
            print("- Actual feasibility must be established through the controlled pilot run (--pilot).")
        
    print("\n[THERMAL SAFETY DISCLAIMER]")
    print("This software cannot guarantee physical temperature safety.")
    print("Training neural networks places extreme sustained load on laptop components.")
    print("1. Monitor your GPU and CPU temperatures using software like MSI Afterburner, HWMonitor, or Task Manager.")
    print("2. Stop the run immediately if temperatures become abnormally high.")
    print("3. Ensure the laptop is plugged into the wall and properly ventilated.")
    print("4. NEVER block cooling fans or place the laptop on a soft surface (like a bed or couch).")
    print("="*50)
    
    with open("hardware_report.json", "w") as f:
        json.dump(hardware_info, f, indent=4)
        
    return hardware_info

if __name__ == "__main__":
    inspect_hardware()
