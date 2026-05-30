import { getAppCheckToken } from "../firebase";

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Resizes the image to fit within maxWidth/maxHeight and compresses it using JPEG quality.
 * 
 * @param {File} file - The original file
 * @param {Object} options - Compression options
 * @returns {Promise<File>} - Resolves to the compressed File object
 */
export const compressImage = (file, options = {}) => {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;
  
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File is not an image'));
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Canvas compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
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
