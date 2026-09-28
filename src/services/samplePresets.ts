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
    title: 'Synthetic Coastal & Port Illustration',
    subtitle: 'Synthetic Demo Illustration (Not real satellite data)',
    badge: 'DEMO ILLUSTRATION',
    description: 'Synthetic vector illustration showing coastal water, shoreline, pier, and grid patterns.',
    mode: 'single',
    query: 'What colors and shapes are visible in this illustration?',
    images: [
      {
        url: '/samples/optical_port.png',
        filename: 'synthetic_coastal_illustration.png',
        modality: 'OPTICAL',
        sensor: 'Synthetic Illustration (Demo)',
        crs: 'Local Pixel Coordinates'
      }
    ]
  },
  {
    id: 'preset-sar-radar',
    title: 'Synthetic Radar Backscatter Illustration',
    subtitle: 'Synthetic Demo Illustration (Not real satellite data)',
    badge: 'DEMO ILLUSTRATION',
    description: 'Synthetic illustration simulating dark specular returns, textured gray speckle, and bright corner reflectors.',
    mode: 'single',
    query: 'Describe the visible textures and light/dark regions.',
    images: [
      {
        url: '/samples/sar_radar.png',
        filename: 'synthetic_radar_illustration.png',
        modality: 'SAR',
        polarization: 'Simulated VV',
        sensor: 'Synthetic Illustration (Demo)',
        crs: 'Local Pixel Coordinates'
      }
    ]
  },
  {
    id: 'preset-cross-modal',
    title: 'Synthetic Cross-Modal Demonstration',
    subtitle: 'Synthetic Demo Pair (Not real satellite data)',
    badge: 'DEMO ILLUSTRATION',
    description: 'Paired synthetic illustrations showing an optical color view alongside a synthetic radar texture.',
    mode: 'optical-sar',
    query: 'What colors and patterns are visible across these two illustrations?',
    images: [
      {
        url: '/samples/optical_port.png',
        filename: 'synthetic_coastal_optical.png',
        modality: 'OPTICAL',
        role: 'PRIMARY',
        sensor: 'Synthetic Illustration (Demo)'
      },
      {
        url: '/samples/sar_radar.png',
        filename: 'synthetic_coastal_radar.png',
        modality: 'SAR',
        role: 'AFTER',
        polarization: 'Simulated VV',
        sensor: 'Synthetic Illustration (Demo)'
      }
    ]
  },
  {
    id: 'preset-bitemporal',
    title: 'Synthetic Temporal Pair (Before / After)',
    subtitle: 'Synthetic Demo Pair (Not real satellite data)',
    badge: 'DEMO ILLUSTRATION',
    description: 'Two synthetic illustrations showing different colored regions between before and after scenes.',
    mode: 'bi-temporal',
    query: 'What differences in colors and shapes are visible between these two illustrations?',
    images: [
      {
        url: '/samples/bitemporal_before.png',
        filename: 'synthetic_before_scene.png',
        modality: 'OPTICAL',
        role: 'BEFORE',
        sensor: 'Synthetic Illustration (Demo)'
      },
      {
        url: '/samples/bitemporal_after.png',
        filename: 'synthetic_after_scene.png',
        modality: 'OPTICAL',
        role: 'AFTER',
        sensor: 'Synthetic Illustration (Demo)'
      }
    ]
  },
  {
    id: 'preset-integrity-gate',
    title: 'Safety & Abstention Gate Check',
    subtitle: 'Synthetic Demo Illustration (Not real satellite data)',
    badge: 'DEMO ILLUSTRATION',
    description: 'Demonstrates system honesty: abstains with plain language when asked questions requiring data not visible in the pixels.',
    mode: 'single',
    query: 'What is the exact water depth in meters and water salinity percentage?',
    images: [
      {
        url: '/samples/sar_radar.png',
        filename: 'synthetic_abstention_check.png',
        modality: 'SAR',
        polarization: 'Simulated VV',
        sensor: 'Synthetic Illustration (Demo)'
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
