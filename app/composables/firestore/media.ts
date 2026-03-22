import { deleteObject, getDownloadURL, listAll, ref as storageRef, uploadBytes, type FirebaseStorage } from "firebase/storage";

export const convertToWebP = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          const newName = file.name.replace(/\.[^/.]+$/, ".webp");
          resolve(new File([blob], newName, { type: "image/webp" }));
        }, "image/webp", 0.8);
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
  folderPath: string
): Promise<string | null> => {
  if (!rawFile) return null;

  try {
    const file = await convertToWebP(rawFile);
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
