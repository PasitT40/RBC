export interface ImageConstraint {
  width: number;
  height: number;
  maxSizeKB: number;
  keepPng?: boolean;
  label: string;
}

export interface ProcessResult {
  ok: boolean;
  blob?: Blob;
  warning?: string;
  error?: string;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function simplifiedRatio(w: number, h: number): string {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("โหลดรูปภาพไม่สำเร็จ"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (quality !== undefined) {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } else {
      canvas.toBlob((blob) => resolve(blob), type);
    }
  });
}

async function processImage(
  file: File,
  constraint: ImageConstraint
): Promise<ProcessResult> {
  // Step 1: Validate file format
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: "รองรับเฉพาะ JPG, PNG, WebP" };
  }

  // Step 2: Load image
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, error: "โหลดรูปภาพไม่สำเร็จ" };
  }

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const targetW = constraint.width;
  const targetH = constraint.height;

  // Step 3: Detect ratio mismatch
  const srcRatio = srcW / srcH;
  const targetRatio = targetW / targetH;
  let warning: string | undefined;
  if (Math.abs(srcRatio - targetRatio) / targetRatio > 0.02) {
    const ratioStr = simplifiedRatio(targetW, targetH);
    warning = `ภาพถูก crop เป็น ${ratioStr} อัตโนมัติ`;
  }

  // Step 4: Center-crop to target ratio on canvas
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { ok: false, error: "ไม่สามารถสร้าง canvas context ได้" };
  }

  const scale = Math.max(targetW / srcW, targetH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const offsetX = (targetW - drawW) / 2;
  const offsetY = (targetH - drawH) / 2;
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  // Step 5: Convert to blob
  const maxBytes = constraint.maxSizeKB * 1024;

  if (constraint.keepPng === true) {
    const blob = await canvasToBlob(canvas, "image/png");
    if (!blob) {
      return { ok: false, error: "แปลงรูปภาพไม่สำเร็จ" };
    }
    return { ok: true, blob, warning };
  }

  // WebP with quality reduction loop; stop reducing at minQuality = 0.40
  let quality = 0.85;
  const minQuality = 0.4;

  while (true) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob) {
      return { ok: false, error: "แปลงรูปภาพไม่สำเร็จ" };
    }
    if (blob.size <= maxBytes) {
      return { ok: true, blob, warning };
    }
    if (quality <= minQuality) {
      // Already tried minimum quality and still too large
      break;
    }
    quality = Math.max(minQuality, quality - 0.05);
  }

  return {
    ok: false,
    error: `ไฟล์ใหญ่เกิน ${constraint.maxSizeKB} KB แม้หลังบีบอัด`,
  };
}

async function validateImageFile(
  file: File,
  constraint: ImageConstraint
): Promise<{ valid: boolean; error?: string }> {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "รองรับเฉพาะ JPG, PNG, WebP" };
  }

  const maxRawBytes = constraint.maxSizeKB * 1024 * 3;
  if (file.size > maxRawBytes) {
    return {
      valid: false,
      error: `ไฟล์ใหญ่เกินไป (ขนาดสูงสุดที่รับได้คือ ${constraint.maxSizeKB * 3} KB)`,
    };
  }

  return { valid: true };
}

export function useImageUpload() {
  return { processImage, validateImageFile };
}
