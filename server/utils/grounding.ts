export interface GroundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
}

export function validateAndNormalizeGroundingBoxes(boxes: any[] | undefined): GroundingBox[] {
  if (!boxes || !Array.isArray(boxes)) {
    return [];
  }

  const validBoxes: GroundingBox[] = [];

  for (const box of boxes) {
    if (typeof box !== 'object' || box === null) continue;

    let { ymin, xmin, ymax, xmax, label } = box;

    // Validate types
    if (typeof ymin !== 'number' || typeof xmin !== 'number' || typeof ymax !== 'number' || typeof xmax !== 'number') continue;
    if (typeof label !== 'string' || label.trim() === '') continue;

    // Reject out of range natively
    if (ymin < 0 || xmin < 0 || ymax < 0 || xmax < 0) continue;
    if (ymin > 1000 || xmin > 1000 || ymax > 1000 || xmax > 1000) continue;

    // Ensure valid coordinates
    if (ymin >= ymax || xmin >= xmax) continue;

    // Convert from 0-1000 scale to 0.0-1.0 scale for the frontend
    // If the model output something very small (already 0-1 scale), we still normalize if we treat it as 0-1000?
    // Wait, if it outputs 0-1000, we must divide by 1000.
    // Let's check if the values are strictly 0-1.0 or 0-1000.
    // If we instruct the model to use 0-1000, we should assume the values are on that scale.
    // What if the model outputs 0.5? On a 0-1000 scale, that's 0.0005. This is consistent.
    // So we just divide by 1000.
    validBoxes.push({
      ymin: ymin / 1000,
      xmin: xmin / 1000,
      ymax: ymax / 1000,
      xmax: xmax / 1000,
      label: label.trim()
    });
  }

  return validBoxes;
}
