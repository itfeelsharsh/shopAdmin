import { getAppCheckToken } from "../firebase";

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Resizes the image to fit within maxWidth/maxHeight and compresses it using JPEG quality.
 * 
 * @param {File} file - The original file
 * @param {Object} options - Compression options
 * @returns {Promise<File>} - Resolves to the compressed File object
 */
/**
 * Checks if a PNG image file has any transparent pixels, and if so,
 * overlays it on a solid white background and returns a new PNG File.
 * 
 * @param {File} file - The original file
 * @returns {Promise<File>} - Resolves to the processed File object
 */
export const addWhiteBackgroundIfTransparent = (file) => {
  return new Promise((resolve) => {
    if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Scan pixels for transparency in alpha channel
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let hasTransparency = false;

        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) {
            hasTransparency = true;
            break;
          }
        }

        if (hasTransparency) {
          // Clear and paint white background
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          // Draw image on top of white
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name, {
                type: "image/png",
                lastModified: Date.now(),
              });
              resolve(processedFile);
            } else {
              resolve(file);
            }
          }, "image/png");
        } else {
          resolve(file);
        }
      } catch (err) {
        console.error("Canvas processing error:", err);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
};

/**
 * Compresses an image file by drawing it to a canvas and exporting as image/jpeg.
 * 
 * @param {File} file - The original file
 * @param {number} quality - Compression quality (0 to 1)
 * @returns {Promise<File>} - Resolves to the compressed File object
 */
export const compressImageUsingCanvas = (file, quality = 0.8) => {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              let newName = file.name;
              if (!newName.toLowerCase().endsWith(".jpg") && !newName.toLowerCase().endsWith(".jpeg")) {
                const parts = newName.split(".");
                if (parts.length > 1) parts.pop();
                newName = parts.join(".") + ".jpg";
              }
              const compressedFile = new File([blob], newName, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          quality
        );
      } catch (e) {
        console.error("Canvas compression error:", e);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
};

/**
 * Image processing pipeline for a single file.
 * 1. Checks PNG transparency and adds solid white background if found.
 * 2. Compresses images ONLY if their size is less than 555 KB.
 * 3. Keeps the original if compression fails or makes the file size larger.
 * 
 * @param {File} file - The original file
 * @returns {Promise<{processedFile: File, originalSize: number, processingStatuses: string[]}>}
 */
export const processFileItem = async (file) => {
  const originalSize = file.size;
  const statuses = [];
  let currentFile = file;

  // 1. Transparency check for PNGs
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) {
    const backgroundFile = await addWhiteBackgroundIfTransparent(file);
    if (backgroundFile !== file) {
      currentFile = backgroundFile;
      statuses.push("White BG Added");
    }
  }

  // 2. Smart compression if size < 555 KB
  if (currentFile.type.startsWith("image/") && currentFile.size < 555 * 1024) {
    try {
      const compressedFile = await compressImageUsingCanvas(currentFile, 0.85);
      if (compressedFile.size < currentFile.size) {
        const savings = Math.round(((currentFile.size - compressedFile.size) / currentFile.size) * 100);
        currentFile = compressedFile;
        statuses.push(`Compressed (-${savings}%)`);
      } else {
        statuses.push("Original Kept (Compressed is larger)");
      }
    } catch (e) {
      console.error("Compression error:", e);
      statuses.push("Compression failed");
    }
  } else if (currentFile.type.startsWith("image/")) {
    statuses.push("Original Kept (Size >= 555KB)");
  }

  return {
    processedFile: currentFile,
    originalSize,
    processingStatuses: statuses,
  };
};

/**
 * Legacy compressImage mapping to support existing code with smart pipeline
 */
export const compressImage = async (file) => {
  const result = await processFileItem(file);
  return result.processedFile;
};

/**
 * Uploads a file/blob to the CDN by retrieving a presigned upload URL first.
 * 
 * @param {File|Blob} file - The file/blob to upload
 * @param {Function} onProgress - Optional progress callback receiving percent (0-100)
 * @returns {Promise<string>} - Resolves to the public CDN URL
 */
export const uploadToCDN = async (file, onProgress) => {
  const filename = file.name || 'image.jpg';
  const contentType = file.type || 'image/jpeg';
  
  // 1. Get presigned R2 upload URL from the admin portal's own API
  const appCheckToken = await getAppCheckToken();
  const headers = { 'Content-Type': 'application/json' };
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }
  const response = await fetch(`/api/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      filename,
      contentType,
    }),
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to get upload URL from local API');
  }
  
  const { uploadUrl, cdnUrl } = await response.json();
  
  // 2. Upload file directly to R2 using XMLHttpRequest to trace upload progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);
    
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }
    
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(cdnUrl);
      } else {
        reject(new Error(`CDN Upload failed with status: ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => {
      reject(new Error('Network error during CDN upload'));
    };
    
    xhr.send(file);
  });
};
