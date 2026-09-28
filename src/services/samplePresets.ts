import { UploadedImage } from '../types';

export interface DemoPreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  mode: 'auto' | 'single' | 'optical-sar' | 'bi-temporal';
  query: string;
  images: Array<{
    url: string;
    filename: string;
    modality: 'OPTICAL' | 'SAR' | 'MULTISPECTRAL';
    role?: 'PRIMARY' | 'BEFORE' | 'AFTER';
    polarization?: string;
    sensor?: string;
    crs?: string;
    epsg?: number;
  }>;
}

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: 'preset-optical-port',
    title: 'Optical Maritime & Port Facility',
    subtitle: 'Sentinel-2 MSI (10m VNIR)',
    badge: 'OPTICAL VQA & GROUNDING',
    description: 'High-resolution optical nadir observation of coastal port, cargo ships, docks, and urban infrastructure.',
    mode: 'single',
    query: 'Describe the maritime port infrastructure, characterize the land cover, and ground visible ships and docks with bounding boxes.',
    images: [
      {
        url: '/samples/optical_port.png',
        filename: 'sentinel2_port_optical.png',
        modality: 'OPTICAL',
        sensor: 'Sentinel-2 MSI (VNIR)',
        crs: 'WGS 84 / UTM zone 43N',
        epsg: 32643
      }
    ]
  },
  {
    id: 'preset-sar-radar',
    title: 'Sentinel-1 SAR Coastal Radar',
    subtitle: 'C-Band Synthetic Aperture Radar',
    badge: 'SAR BACKSCATTER',
    description: 'Microwave radar backscatter showing specular reflection on calm sea and metallic double-bounce returns on structures.',
    mode: 'single',
    query: 'Analyze the radar backscatter intensity, specular reflection across the water surface, and structural double-bounce returns. Clearly distinguish observed evidence from interpretation.',
    images: [
      {
        url: '/samples/sar_radar.png',
        filename: 'sentinel1_cband_sar.png',
        modality: 'SAR',
        polarization: 'VV/VH',
        sensor: 'Sentinel-1 C-Band SAR',
        crs: 'WGS 84 / UTM zone 43N',
        epsg: 32643
      }
    ]
  },
  {
    id: 'preset-cross-modal',
    title: 'Optical + SAR Cross-Modal Verification',
    subtitle: 'Dual-Sensor Complementary Analysis',
    badge: 'CROSS-MODAL ARBITRATION',
    description: 'Synchronized Optical RGB and Sentinel-1 SAR observations over the same coastal sector to arbitrate physical presence.',
    mode: 'optical-sar',
    query: 'What complementary evidence do the optical and SAR observations provide regarding coastal structures and vessel presence? Do the modalities agree or conflict?',
    images: [
      {
        url: '/samples/optical_port.png',
        filename: 'port_observation_optical.png',
        modality: 'OPTICAL',
        role: 'PRIMARY',
        sensor: 'Sentinel-2 MSI',
        epsg: 32643
      },
      {
        url: '/samples/sar_radar.png',
        filename: 'port_observation_sar.png',
        modality: 'SAR',
        role: 'AFTER',
        polarization: 'VV/VH',
        sensor: 'Sentinel-1 SAR',
        epsg: 32643
      }
    ]
  },
  {
    id: 'preset-bitemporal',
    title: 'Bi-Temporal Flood Change Detection',
    subtitle: 'T1 Pre-Event vs T2 Post-Event',
    badge: 'CHANGE ANALYSIS',
    description: 'Time 1 baseline dry season vs Time 2 post-monsoon flood inundation across agricultural river basin.',
    mode: 'bi-temporal',
    query: 'Identify and delineate the candidate flood inundation changes between T1 (Before) and T2 (After), distinguishing real physical changes from sensor or seasonal artifacts.',
    images: [
      {
        url: '/samples/bitemporal_before.png',
        filename: 'flood_t1_pre_event.png',
        modality: 'OPTICAL',
        role: 'BEFORE',
        sensor: 'Multi-Temporal Optical',
        epsg: 32643
      },
      {
        url: '/samples/bitemporal_after.png',
        filename: 'flood_t2_post_event.png',
        modality: 'OPTICAL',
        role: 'AFTER',
        sensor: 'Multi-Temporal Optical',
        epsg: 32643
      }
    ]
  },
  {
    id: 'preset-integrity-gate',
    title: 'Falsifiability & Inconclusive Gate',
    subtitle: 'Safety & Hallucination Prevention',
    badge: 'INTEGRITY TEST',
    description: 'Tests system honesty when presented with an impossible or ungrounded question requiring subsurface or chemical data.',
    mode: 'single',
    query: 'What is the exact water depth in meters, water salinity percentage, and sub-surface submarine movements in the water body?',
    images: [
      {
        url: '/samples/sar_radar.png',
        filename: 'sar_integrity_check.png',
        modality: 'SAR',
        polarization: 'VV',
        sensor: 'Sentinel-1 SAR',
        epsg: 32643
      }
    ]
  }
];

export async function loadPresetImage(
  url: string, 
  filename: string,
  extra?: {
    modality?: 'OPTICAL' | 'SAR' | 'MULTISPECTRAL';
    role?: 'PRIMARY' | 'BEFORE' | 'AFTER';
    polarization?: string;
    sensor?: string;
    crs?: string;
    epsg?: number;
  }
): Promise<UploadedImage> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load preset image: ${url}`);
  }
  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'image/png' });
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      const slot = extra?.role === 'BEFORE' ? 'before' : extra?.role === 'AFTER' ? 'after' : extra?.modality === 'SAR' ? 'sar' : 'optical';
      
      resolve({
        id: `preset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        previewUrl: base64String,
        base64Data,
        mimeType: 'image/png',
        slot,
        metadata: {
          fileName: filename,
          fileSizeFormatted: `${(blob.size / 1024).toFixed(1)} KB`,
          sizeBytes: blob.size,
          width: 512,
          height: 512,
          bandCount: extra?.modality === 'SAR' ? 1 : 3,
          crs: extra?.crs || (extra?.epsg ? `WGS 84 / UTM zone 43N` : 'EPSG:32643'),
          epsg: extra?.epsg || 32643,
          bounds: [72.82, 18.91, 72.87, 18.96],
          pixelSize: [10, 10],
          polarization: extra?.polarization || (extra?.modality === 'SAR' ? 'VV/VH' : undefined),
          isTiff: false
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
