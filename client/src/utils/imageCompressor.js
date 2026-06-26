const MAX_SIZE  = 1600;
const QUALITY   = 0.80;
const MAX_BYTES = 9 * 1024 * 1024;

export async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.size < 500 * 1024) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height) {
        if (width > MAX_SIZE) { height = Math.round(height * MAX_SIZE / width); width = MAX_SIZE; }
      } else {
        if (height > MAX_SIZE) { width = Math.round(width * MAX_SIZE / height); height = MAX_SIZE; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(file);
        if (blob.size > MAX_BYTES) {
          canvas.toBlob((blob2) => {
            resolve(new File([blob2 || blob], sanitizeName(file.name), { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.60);
        } else {
          resolve(new File([blob], sanitizeName(file.name), { type: 'image/jpeg' }));
        }
      }, 'image/jpeg', QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export async function compressImages(files) {
  return Promise.all(files.map(compressImage));
}

function sanitizeName(name) {
  return name.replace(/\.[^/.]+$/, '') + '.jpg';
}