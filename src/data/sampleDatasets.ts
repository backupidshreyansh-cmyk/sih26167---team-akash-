import { UploadedImage } from '../types';

export interface SampleDataset {
  id: string;
  title: string;
  badge: string;
  sampleType: 'Demo / synthetic example' | 'Real remote-sensing observation';
  description: string;
  recommendedQueries: string[];
  images: {
    slot: 'optical' | 'sar' | 'before' | 'after';
    name: string;
    mimeType: string;
    svgContent: string;
    metadata: {
      width: number;
      height: number;
      bandCount: number;
      crs: string;
      epsg: number;
      bounds: number[];
      pixelSize: [number, number];
      polarization?: string;
      isTiff: boolean;
    };
  }[];
}

// Helper to convert SVG to data URI
function svgToDataUri(svg: string): string {
  const cleaned = svg.replace(/\s+/g, ' ').trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleaned)}`;
}

// Helper to convert SVG data URI to a synthetic base64 string
function svgToBase64(svg: string): string {
  const cleaned = svg.replace(/\s+/g, ' ').trim();
  if (typeof btoa !== 'undefined') {
    try {
      return btoa(unescape(encodeURIComponent(cleaned)));
    } catch {
      return btoa(cleaned);
    }
  }
  return Buffer.from(cleaned).toString('base64');
}

// 1. VISAKHAPATNAM PORT (Optical)
const opticalCoastalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="oceanGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#123b5d"/>
      <stop offset="100%" stop-color="#0a2238"/>
    </linearGradient>
    <pattern id="urbanGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="36" height="36" fill="#717a84" rx="2"/>
      <rect x="4" y="4" width="12" height="12" fill="#d97706" opacity="0.8"/>
      <rect x="20" y="4" width="12" height="12" fill="#b45309" opacity="0.8"/>
      <rect x="4" y="20" width="12" height="12" fill="#9a3412" opacity="0.8"/>
      <rect x="20" y="20" width="12" height="12" fill="#475569" opacity="0.8"/>
    </pattern>
    <pattern id="vegPattern" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#2d6a4f"/>
      <circle cx="5" cy="5" r="3" fill="#1b4332"/>
      <circle cx="15" cy="15" r="4" fill="#40916c"/>
    </pattern>
  </defs>

  <!-- Water Body -->
  <rect x="0" y="0" width="800" height="800" fill="url(#oceanGrad)"/>
  
  <!-- Coastal Shoreline & Landmass -->
  <path d="M 0,220 Q 250,180 420,320 T 800,450 L 800,800 L 0,800 Z" fill="url(#vegPattern)"/>

  <!-- Port Industrial / Breakwater Quay -->
  <path d="M 220,250 L 380,180 L 460,340 L 320,400 Z" fill="#94a3b8" stroke="#334155" stroke-width="4"/>
  <rect x="250" y="220" width="100" height="60" fill="#3b82f6" opacity="0.9"/>
  <rect x="280" y="300" width="120" height="70" fill="#ef4444" opacity="0.9"/>

  <!-- Container Terminal Grid -->
  <rect x="380" y="380" width="380" height="380" fill="url(#urbanGrid)" stroke="#cbd5e1" stroke-width="2"/>

  <!-- Maritime Logistics Roads -->
  <path d="M 0,220 L 400,340 L 800,340" stroke="#f8fafc" stroke-width="8" stroke-dasharray="16,8" fill="none"/>
  <path d="M 400,340 L 400,800" stroke="#e2e8f0" stroke-width="6" fill="none"/>

  <!-- Docked Cargo Vessels -->
  <polygon points="180,240 210,230 220,250 190,260" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
  <polygon points="280,150 330,135 340,165 290,180" fill="#10b981" stroke="#064e3b" stroke-width="2"/>

  <!-- Coordinate Grid Overlay Overlay -->
  <text x="20" y="40" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">ISRO EO OPTICAL L2A [RGB-TRUECOLOR] 10m/px</text>
  <text x="20" y="60" fill="#94a3b8" font-family="monospace" font-size="12">EPSG:32644 (UTM Zone 44N) | Visakhapatnam Port</text>
</svg>
`;

// 2. SAR RADAR (Sentinel-1 C-Band VV/VH backscatter)
const sarRadarSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <radialGradient id="cornerReflector" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#fef08a"/>
      <stop offset="100%" stop-color="#854d0e" stop-opacity="0"/>
    </radialGradient>
    <filter id="radarSpeckle">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" result="noise"/>
      <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0"/>
    </filter>
  </defs>

  <!-- Specular Smooth Surface (Water): Very Low Backscatter (Dark Black) -->
  <rect x="0" y="0" width="800" height="800" fill="#080b10"/>

  <!-- Rough Soil & Vegetation: Moderate Diffuse Backscatter (Medium Gray Speckle) -->
  <path d="M 0,220 Q 250,180 420,320 T 800,450 L 800,800 L 0,800 Z" fill="#2d3748" filter="url(#radarSpeckle)" opacity="0.6"/>

  <!-- Pier & Gantry Foundation: Strong Radar Returns -->
  <path d="M 220,250 L 380,180 L 460,340 L 320,400 Z" fill="#64748b" stroke="#cbd5e1" stroke-width="2"/>

  <!-- Metallic Cranes & High-Rise Buildings: Intense Double-Bounce Corner Reflection -->
  <circle cx="280" cy="210" r="16" fill="url(#cornerReflector)"/>
  <circle cx="340" cy="260" r="20" fill="url(#cornerReflector)"/>
  <circle cx="390" cy="310" r="18" fill="url(#cornerReflector)"/>
  <circle cx="200" cy="245" r="14" fill="url(#cornerReflector)"/>

  <!-- Metallic Warehouse Grid: Distinct High Backscatter Linear Rows -->
  <g fill="#94a3b8" opacity="0.85">
    <rect x="420" y="420" width="80" height="15" rx="2"/>
    <rect x="420" y="450" width="80" height="15" rx="2"/>
    <rect x="420" y="480" width="80" height="15" rx="2"/>
    <rect x="540" y="420" width="100" height="18" rx="2"/>
    <rect x="540" y="455" width="100" height="18" rx="2"/>
    <rect x="540" y="490" width="100" height="18" rx="2"/>
    <rect x="440" y="550" width="220" height="25" rx="2"/>
    <rect x="440" y="600" width="220" height="25" rx="2"/>
  </g>

  <!-- SAR Flight & Sensor Indicators -->
  <text x="20" y="40" fill="#facc15" font-family="monospace" font-size="14" font-weight="bold">SENTINEL-1 SAR C-BAND [VV/VH INTENSITY] 10m/px</text>
  <text x="20" y="60" fill="#94a3b8" font-family="monospace" font-size="12">Polarization: Dual VV/VH | Incidence Angle: 38.4°</text>
</svg>
`;

// 3. BEFORE: BENGALURU OUTER RING (2021 T1)
const beforeExpansionSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="agroGreen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#386641"/>
      <stop offset="100%" stop-color="#6a994e"/>
    </linearGradient>
  </defs>

  <!-- Continuous Agricultural Land & Pasture -->
  <rect x="0" y="0" width="800" height="800" fill="url(#agroGreen)"/>

  <!-- Farmland Plot Boundaries -->
  <rect x="50" y="50" width="300" height="220" fill="#588157" stroke="#344e41" stroke-width="2"/>
  <rect x="400" y="60" width="350" height="250" fill="#a7c957" stroke="#344e41" stroke-width="2"/>
  <rect x="80" y="320" width="280" height="380" fill="#40916c" stroke="#1b4332" stroke-width="2"/>
  <rect x="420" y="360" width="320" height="360" fill="#52b788" stroke="#2d6a4f" stroke-width="2"/>

  <!-- Retention Water Body (Pond) -->
  <path d="M 450,180 Q 520,120 580,190 T 510,260 Z" fill="#0077b6"/>

  <!-- Single Narrow Dirt Track Road -->
  <path d="M 0,400 Q 380,390 800,420" stroke="#d4a373" stroke-width="6" fill="none"/>

  <text x="20" y="40" fill="#86efac" font-family="monospace" font-size="14" font-weight="bold">TEMPORAL OBSERVATION T1 (BEFORE: 2021-03-12)</text>
  <text x="20" y="60" fill="#e2e8f0" font-family="monospace" font-size="12">Sensor: Sentinel-2 MSI L2A | Land Cover: Dominant Agriculture &amp; Vegetation</text>
</svg>
`;

// 4. AFTER: BENGALURU OUTER RING (2024 T2)
const afterExpansionSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="agroGreen2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#386641"/>
      <stop offset="100%" stop-color="#6a994e"/>
    </linearGradient>
    <pattern id="builtupPattern" width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="28" height="28" fill="#94a3b8" rx="2"/>
      <rect x="3" y="3" width="10" height="10" fill="#0284c7"/>
      <rect x="15" y="15" width="10" height="10" fill="#ea580c"/>
    </pattern>
  </defs>

  <!-- Remaining Agricultural Base -->
  <rect x="0" y="0" width="800" height="800" fill="url(#agroGreen2)"/>
  <rect x="50" y="50" width="300" height="220" fill="#588157" stroke="#344e41" stroke-width="2"/>

  <!-- Major 6-Lane Asphalt Highway & Arterial Roads -->
  <path d="M 0,400 Q 380,390 800,420" stroke="#1e293b" stroke-width="24" fill="none"/>
  <path d="M 0,400 Q 380,390 800,420" stroke="#facc15" stroke-width="2" stroke-dasharray="14,10" fill="none"/>
  <path d="M 460,0 L 460,800" stroke="#334155" stroke-width="16" fill="none"/>

  <!-- Construction Clearing & Tech Park Phase 1 (Built-Up Transition) -->
  <rect x="420" y="360" width="340" height="380" fill="url(#builtupPattern)" stroke="#0f172a" stroke-width="3"/>
  <rect x="460" y="60" width="280" height="260" fill="#ca8a04" opacity="0.8" stroke="#854d0e" stroke-width="2"/> <!-- Cleared Soil -->

  <!-- Shrunken Water Retention Basin -->
  <path d="M 450,180 Q 490,140 530,190 T 480,240 Z" fill="#0077b6"/>

  <text x="20" y="40" fill="#f87171" font-family="monospace" font-size="14" font-weight="bold">TEMPORAL OBSERVATION T2 (AFTER: 2024-03-18)</text>
  <text x="20" y="60" fill="#e2e8f0" font-family="monospace" font-size="12">Sensor: Sentinel-2 MSI L2A | Land Cover: High Built-Up Expansion (+34.2%)</text>
</svg>
`;

// 5. CLOUD OBSCURED (Optical)
const cloudObscuredSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <filter id="cloudBlur">
      <feGaussianBlur stdDeviation="15"/>
    </filter>
  </defs>

  <!-- Surface Peekthroughs -->
  <rect x="0" y="0" width="800" height="800" fill="#1b4332"/>
  <path d="M 0,300 Q 400,200 800,500" stroke="#0f172a" stroke-width="18" fill="none"/>

  <!-- Dense Monsoon Cumulus Cloud Cover -->
  <path d="M 50,100 Q 250,50 400,180 T 750,220 Q 820,380 650,520 T 250,600 Q 20,480 50,100 Z" fill="#ffffff" opacity="0.92" filter="url(#cloudBlur)"/>
  <path d="M 300,300 Q 550,220 700,380 T 520,720 Q 200,680 300,300 Z" fill="#f1f5f9" opacity="0.88" filter="url(#cloudBlur)"/>

  <!-- Cloud Shadow on Ground -->
  <ellipse cx="480" cy="540" rx="160" ry="90" fill="#020617" opacity="0.6" filter="url(#cloudBlur)"/>

  <text x="20" y="40" fill="#f43f5e" font-family="monospace" font-size="14" font-weight="bold">OPTICAL SENSOR: HEAVY MONSOON CLOUD COVER</text>
  <text x="20" y="60" fill="#cbd5e1" font-family="monospace" font-size="12">Ground surface obscured (&gt;65% cloud fraction)</text>
</svg>
`;

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'optical_port_scene',
    title: 'Visakhapatnam Port Coastal Infrastructure',
    badge: 'Optical Scene',
    sampleType: 'Demo / synthetic example',
    description: 'Synthesized coastal scene with deep maritime water, breakwater pier, docked cargo vessels, and container logistics terminals.',
    recommendedQueries: [
      'What is visible in this image?',
      'Identify maritime infrastructure, docks, and coastal boundary',
      'Where is the built-up area?'
    ],
    images: [
      {
        slot: 'optical',
        name: 'visakhapatnam_port_synthetic.tif',
        mimeType: 'image/svg+xml',
        svgContent: opticalCoastalSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'WGS 84 / UTM zone 44N',
          epsg: 32644,
          bounds: [742100, 1958200, 750100, 1966200],
          pixelSize: [10, 10],
          isTiff: true
        }
      }
    ]
  },
  {
    id: 'bitemporal_expansion',
    title: 'Bengaluru Urban Growth (Temporal Change)',
    badge: 'Temporal Pair',
    sampleType: 'Demo / synthetic example',
    description: 'Matched synthetic temporal pair demonstrating agricultural land conversion into multi-lane asphalt highway and built-up development.',
    recommendedQueries: [
      'Did built-up area increase between these observations?',
      'Identify candidate physical change regions and ground them',
      'Did the water extent change between these dates?'
    ],
    images: [
      {
        slot: 'before',
        name: 'bengaluru_expansion_t1_synthetic.tif',
        mimeType: 'image/svg+xml',
        svgContent: beforeExpansionSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'WGS 84 / UTM zone 43N',
          epsg: 32643,
          bounds: [682000, 1432000, 690000, 1440000],
          pixelSize: [10, 10],
          isTiff: true
        }
      },
      {
        slot: 'after',
        name: 'bengaluru_expansion_t2_synthetic.tif',
        mimeType: 'image/svg+xml',
        svgContent: afterExpansionSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'WGS 84 / UTM zone 43N',
          epsg: 32643,
          bounds: [682000, 1432000, 690000, 1440000],
          pixelSize: [10, 10],
          isTiff: true
        }
      }
    ]
  },
  {
    id: 'sar_radar_complex',
    title: 'Industrial Radar Backscatter (SAR C-Band)',
    badge: 'SAR Radar',
    sampleType: 'Demo / synthetic example',
    description: 'Microwave radar simulation showcasing double-bounce vertical returns, rough surface scatter, and specular water absorption.',
    recommendedQueries: [
      'Evaluate radar backscatter intensity and structural permanence',
      'Assess smooth specular surfaces vs rough double-bounce returns',
      'Identify potential metallic or vertical built structures'
    ],
    images: [
      {
        slot: 'sar',
        name: 'industrial_sar_cband_synthetic.tif',
        mimeType: 'image/svg+xml',
        svgContent: sarRadarSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 1,
          crs: 'WGS 84 / UTM zone 44N',
          epsg: 32644,
          bounds: [742100, 1958200, 750100, 1966200],
          pixelSize: [10, 10],
          polarization: 'VV/VH',
          isTiff: true
        }
      }
    ]
  },
  {
    id: 'crossmodal_cloud_penetration',
    title: 'Monsoon Cloud Obscuration vs SAR Penetration',
    badge: 'Optical + SAR',
    sampleType: 'Demo / synthetic example',
    description: 'Synthetic cross-modal demonstration: optical image suffers dense cloud cover, while microwave SAR penetrates clouds to inspect ground features.',
    recommendedQueries: [
      'Compare optical observation with SAR radar backscatter',
      'Verify structural features obscured by cloud cover using SAR radar penetration',
      'Check for cross-modal agreement or sensor conflict'
    ],
    images: [
      {
        slot: 'optical',
        name: 'optical_monsoon_cloud_cover.tif',
        mimeType: 'image/svg+xml',
        svgContent: cloudObscuredSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'WGS 84 / UTM zone 44N',
          epsg: 32644,
          bounds: [742100, 1958200, 750100, 1966200],
          pixelSize: [10, 10],
          isTiff: true
        }
      },
      {
        slot: 'sar',
        name: 'sar_allweather_radar_penetration.tif',
        mimeType: 'image/svg+xml',
        svgContent: sarRadarSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 1,
          crs: 'WGS 84 / UTM zone 44N',
          epsg: 32644,
          bounds: [742100, 1958200, 750100, 1966200],
          pixelSize: [10, 10],
          polarization: 'VV/VH',
          isTiff: true
        }
      }
    ]
  }
];

export function loadSampleDataset(dataset: SampleDataset): UploadedImage[] {
  return dataset.images.map((item, idx) => {
    const dataUri = svgToDataUri(item.svgContent);
    const base64 = svgToBase64(item.svgContent);

    // Create a mock File object
    const blob = new Blob([item.svgContent], { type: 'image/svg+xml' });
    const file = new File([blob], item.name, { type: 'image/svg+xml' });

    return {
      id: `sample_${dataset.id}_${item.slot}_${Date.now()}_${idx}`,
      file,
      previewUrl: dataUri,
      base64Data: base64,
      mimeType: 'image/svg+xml',
      slot: item.slot,
      metadata: {
        fileName: item.name,
        fileSizeFormatted: `${(blob.size / 1024).toFixed(1)} KB`,
        sizeBytes: blob.size,
        width: item.metadata.width,
        height: item.metadata.height,
        bandCount: item.metadata.bandCount,
        crs: item.metadata.crs,
        epsg: item.metadata.epsg,
        bounds: item.metadata.bounds,
        pixelSize: item.metadata.pixelSize,
        polarization: item.metadata.polarization,
        isTiff: item.metadata.isTiff
      }
    };
  });
}
