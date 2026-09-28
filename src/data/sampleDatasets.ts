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

// 1. Synthetic Coastal & Port Illustration (Demo)
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
  <text x="20" y="40" fill="#38bdf8" font-family="monospace" font-size="14" font-weight="bold">SYNTHETIC DEMO ILLUSTRATION (Not real satellite data)</text>
  <text x="20" y="60" fill="#94a3b8" font-family="monospace" font-size="12">Synthetic Coastal Scene | Visible colors: blue, green, gray</text>
</svg>
`;

// 2. Synthetic Radar Texture Illustration (Demo)
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
  <text x="20" y="40" fill="#facc15" font-family="monospace" font-size="14" font-weight="bold">SYNTHETIC DEMO ILLUSTRATION (Not real satellite data)</text>
  <text x="20" y="60" fill="#94a3b8" font-family="monospace" font-size="12">Synthetic Radar Texture | High/low intensity contrast simulation</text>
</svg>
`;

// 3. Synthetic Before Scene Illustration
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

  <text x="20" y="40" fill="#86efac" font-family="monospace" font-size="14" font-weight="bold">SYNTHETIC DEMO ILLUSTRATION: BEFORE SCENE (Not real satellite data)</text>
  <text x="20" y="60" fill="#e2e8f0" font-family="monospace" font-size="12">Synthetic Illustration | Predominantly green-toned field shapes</text>
</svg>
`;

// 4. Synthetic After Scene Illustration
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

  <text x="20" y="40" fill="#f87171" font-family="monospace" font-size="14" font-weight="bold">SYNTHETIC DEMO ILLUSTRATION: AFTER SCENE (Not real satellite data)</text>
  <text x="20" y="60" fill="#e2e8f0" font-family="monospace" font-size="12">Synthetic Illustration | Distinct linear dark path and grid patterns</text>
</svg>
`;

// 5. Synthetic Cloud Obscured Scene Illustration
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

  <text x="20" y="40" fill="#f43f5e" font-family="monospace" font-size="14" font-weight="bold">SYNTHETIC DEMO ILLUSTRATION: CLOUD OVERLAY (Not real satellite data)</text>
  <text x="20" y="60" fill="#cbd5e1" font-family="monospace" font-size="12">Synthetic Illustration | White opaque shapes over dark background</text>
</svg>
`;

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'optical_port_scene',
    title: 'Synthetic Coastal & Port Scene',
    badge: 'Synthetic Illustration',
    sampleType: 'Demo / synthetic example',
    description: 'Synthesized vector illustration depicting coastal water, shoreline, pier, and grid patterns.',
    recommendedQueries: [
      'What colors and shapes are visible in this image?',
      'Is green vegetation present?',
      'Describe the visible features, colors, and patterns.'
    ],
    images: [
      {
        slot: 'optical',
        name: 'synthetic_coastal_illustration.tif',
        mimeType: 'image/svg+xml',
        svgContent: opticalCoastalSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'Local Pixel Coordinates',
          epsg: 0,
          bounds: [0, 0, 800, 800],
          pixelSize: [1, 1],
          isTiff: true
        }
      }
    ]
  },
  {
    id: 'bitemporal_expansion',
    title: 'Synthetic Temporal Pair (Before / After)',
    badge: 'Synthetic Pair',
    sampleType: 'Demo / synthetic example',
    description: 'Matched synthetic temporal illustrations demonstrating visible differences in shapes and colors between two scenes.',
    recommendedQueries: [
      'What differences in colors and shapes are visible between these two images?',
      'What visible features stayed the same between before and after?',
      'Describe differences in color regions between the two scenes.'
    ],
    images: [
      {
        slot: 'before',
        name: 'synthetic_before_scene.tif',
        mimeType: 'image/svg+xml',
        svgContent: beforeExpansionSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'Local Pixel Coordinates',
          epsg: 0,
          bounds: [0, 0, 800, 800],
          pixelSize: [1, 1],
          isTiff: true
        }
      },
      {
        slot: 'after',
        name: 'synthetic_after_scene.tif',
        mimeType: 'image/svg+xml',
        svgContent: afterExpansionSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'Local Pixel Coordinates',
          epsg: 0,
          bounds: [0, 0, 800, 800],
          pixelSize: [1, 1],
          isTiff: true
        }
      }
    ]
  },
  {
    id: 'sar_radar_complex',
    title: 'Synthetic Radar Backscatter Scene',
    badge: 'Synthetic Radar',
    sampleType: 'Demo / synthetic example',
    description: 'Simulated radar illustration showcasing dark specular surfaces, textured gray speckle, and bright reflectors.',
    recommendedQueries: [
      'Describe the visible textures and light/dark regions.',
      'What geometric shapes or bright reflectors are visible?',
      'Are smooth dark specular surfaces visible?'
    ],
    images: [
      {
        slot: 'sar',
        name: 'synthetic_radar_texture.tif',
        mimeType: 'image/svg+xml',
        svgContent: sarRadarSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 1,
          crs: 'Local Pixel Coordinates',
          epsg: 0,
          bounds: [0, 0, 800, 800],
          pixelSize: [1, 1],
          polarization: 'Simulated VV',
          isTiff: true
        }
      }
    ]
  },
  {
    id: 'crossmodal_cloud_penetration',
    title: 'Synthetic Multi-Sensor Pair (Optical + Radar)',
    badge: 'Synthetic Multi-Sensor',
    sampleType: 'Demo / synthetic example',
    description: 'Synthetic demonstration showing an optical color view with cloud shapes alongside a synthetic radar texture.',
    recommendedQueries: [
      'What colors and patterns are visible across these two images?',
      'Compare the visible shapes and textures between the two observations.',
      'What visible patterns and brightness differences appear between the two scenes?'
    ],
    images: [
      {
        slot: 'optical',
        name: 'synthetic_cloud_optical.tif',
        mimeType: 'image/svg+xml',
        svgContent: cloudObscuredSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 3,
          crs: 'Local Pixel Coordinates',
          epsg: 0,
          bounds: [0, 0, 800, 800],
          pixelSize: [1, 1],
          isTiff: true
        }
      },
      {
        slot: 'sar',
        name: 'synthetic_penetration_radar.tif',
        mimeType: 'image/svg+xml',
        svgContent: sarRadarSvg,
        metadata: {
          width: 800,
          height: 800,
          bandCount: 1,
          crs: 'Local Pixel Coordinates',
          epsg: 0,
          bounds: [0, 0, 800, 800],
          pixelSize: [1, 1],
          polarization: 'Simulated VV',
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
