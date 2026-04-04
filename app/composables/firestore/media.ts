import { deleteObject, getDownloadURL, listAll, ref as storageRef, uploadBytes, type FirebaseStorage } from "firebase/storage";

export type WebPConversionOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export const IMAGE_UPLOAD_PROFILES = {
  categoryOrBrandBanner: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.8,
  },
  productGallery: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
  },
  siteBanner: {
    maxWidth: 1600,
    maxHeight: 900,
    quality: 0.8,
  },
  siteCredit: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
  },
} as const satisfies Record<string, WebPConversionOptions>;

const getResizedDimensions = (
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number,
) => {
  if (!maxWidth && !maxHeight) {
    return { width, height };
  }

  const widthRatio = maxWidth ? maxWidth / width : Number.POSITIVE_INFINITY;
  const heightRatio = maxHeight ? maxHeight / height : Number.POSITIVE_INFINITY;
  const scale = Math.min(widthRatio, heightRatio, 1);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const convertToWebP = (file: File, options: WebPConversionOptions = {}): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = getResizedDimensions(
          img.width,
          img.height,
          options.maxWidth,
          options.maxHeight,
        );
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          const newName = file.name.replace(/\.[^/.]+$/, ".webp");
          resolve(new File([blob], newName, { type: "image/webp" }));
        }, "image/webp", options.quality ?? 0.8);
      };
      img.onerror = (err) => reject(err);
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const uploadImageAsWebP = async (
  storage: FirebaseStorage,
  rawFile: File,
  folderPath: string,
  options: WebPConversionOptions = {},
): Promise<string | null> => {
  if (!rawFile) return null;

  try {
    const file = await convertToWebP(rawFile, options);
    const fileName = `${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, `${folderPath}/${fileName}`);
    const snapshot = await uploadBytes(fileRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error("Error uploading image:", error);
    return null;
  }
};

export const deleteStorageUrl = async (
  storage: FirebaseStorage,
  url: string | null | undefined
): Promise<void> => {
  if (!url) return;

  try {
    if (url.includes("firebasestorage.googleapis.com")) {
      const pathStartIndex = url.indexOf("/o/") + 3;
      const pathEndIndex = url.indexOf("?");
      if (pathStartIndex > 2 && pathEndIndex > -1) {
        const filePath = decodeURIComponent(url.substring(pathStartIndex, pathEndIndex));
        await deleteObject(storageRef(storage, filePath));
        return;
      }
    }

    await deleteObject(storageRef(storage, url));
  } catch (error) {
    console.warn("Could not delete image:", error);
  }
};

export const deleteStorageUrls = async (storage: FirebaseStorage, urls: string[]) => {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  await Promise.all(uniqueUrls.map((url) => deleteStorageUrl(storage, url)));
};

export const deleteStorageFolder = async (storage: FirebaseStorage, folderPath: string): Promise<void> => {
  try {
    const folderRef = storageRef(storage, folderPath);
    const list = await listAll(folderRef);
    await Promise.all(list.items.map((item) => deleteObject(item)));
  } catch (error) {
    console.warn("Could not delete folder:", error);
  }
};
