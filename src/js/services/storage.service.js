const MAX_POST_IMAGE_BYTES = 340 * 1024;
const MAX_AVATAR_IMAGE_BYTES = 170 * 1024;
const MAX_COVER_IMAGE_BYTES = 380 * 1024;
const MAX_MESSAGE_IMAGE_BYTES = 240 * 1024;

const POST_IMAGE_SETTINGS = { maxWidth: 1180, maxHeight: 1180, quality: 0.72, maxBytes: MAX_POST_IMAGE_BYTES };
const AVATAR_IMAGE_SETTINGS = { maxWidth: 360, maxHeight: 360, quality: 0.72, maxBytes: MAX_AVATAR_IMAGE_BYTES };
const COVER_IMAGE_SETTINGS = { maxWidth: 1500, maxHeight: 620, quality: 0.7, maxBytes: MAX_COVER_IMAGE_BYTES };
const MESSAGE_IMAGE_SETTINGS = { maxWidth: 980, maxHeight: 980, quality: 0.7, maxBytes: MAX_MESSAGE_IMAGE_BYTES };

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';

export function cloudinaryReady() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);
}

export function isImageFile(file) {
  return Boolean(file && file.type && file.type.startsWith('image/'));
}

export function isVideoFile(file) {
  return Boolean(file && file.type && file.type.startsWith('video/'));
}

export async function uploadPostMedia(file) {
  if (!file || file.size === 0) return null;

  if (cloudinaryReady()) {
    return uploadToCloudinary(file, {
      folder: 'pixora/posts',
      resourceType: isVideoFile(file) ? 'video' : 'image'
    });
  }

  if (isVideoFile(file)) {
    throw new Error('Video uploads need Cloudinary. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET, then rebuild.');
  }
  if (!isImageFile(file)) throw new Error('Please choose an image or video file.');

  const dataUrl = await compressImageToDataUrl(file, POST_IMAGE_SETTINGS);
  return { url: dataUrl, type: 'image', path: 'firestore-inline-image', name: file.name };
}

export async function uploadCoverImage(fileOrDataUrl) {
  if (!fileOrDataUrl) return null;

  if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/')) {
    if (cloudinaryReady()) {
      const file = dataUrlToFile(fileOrDataUrl, 'pixora-cover.jpg');
      return uploadToCloudinary(file, { folder: 'pixora/covers', resourceType: 'image' });
    }
    return { url: fileOrDataUrl, type: 'image', path: 'firestore-inline-cover', name: 'cover-image.jpg' };
  }

  if (!isImageFile(fileOrDataUrl)) throw new Error('Cover image must be an image file.');
  if (cloudinaryReady()) return uploadToCloudinary(fileOrDataUrl, { folder: 'pixora/covers', resourceType: 'image' });
  const dataUrl = await compressImageToDataUrl(fileOrDataUrl, COVER_IMAGE_SETTINGS);
  return { url: dataUrl, type: 'image', path: 'firestore-inline-cover', name: fileOrDataUrl.name };
}

export async function uploadMessageImage(file) {
  if (!file || file.size === 0) return null;
  if (!isImageFile(file)) throw new Error('Please choose an image file.');

  if (cloudinaryReady()) return uploadToCloudinary(file, { folder: 'pixora/messages', resourceType: 'image' });
  const dataUrl = await compressImageToDataUrl(file, MESSAGE_IMAGE_SETTINGS);
  return { url: dataUrl, type: 'image', path: 'firestore-inline-message-image', name: file.name };
}

export async function uploadAvatar(fileOrDataUrl) {
  if (!fileOrDataUrl) return null;

  if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/')) {
    if (cloudinaryReady()) {
      const file = dataUrlToFile(fileOrDataUrl, 'pixora-avatar.jpg');
      return uploadToCloudinary(file, { folder: 'pixora/avatars', resourceType: 'image' });
    }
    return { url: fileOrDataUrl, type: 'image', path: 'firestore-inline-avatar', name: 'cropped-avatar.jpg' };
  }

  if (!isImageFile(fileOrDataUrl)) throw new Error('Avatar must be an image file.');
  if (cloudinaryReady()) return uploadToCloudinary(fileOrDataUrl, { folder: 'pixora/avatars', resourceType: 'image' });
  const dataUrl = await compressImageToDataUrl(fileOrDataUrl, AVATAR_IMAGE_SETTINGS);
  return { url: dataUrl, type: 'image', path: 'firestore-inline-avatar', name: fileOrDataUrl.name };
}

async function uploadToCloudinary(file, options = {}) {
  if (!cloudinaryReady()) throw new Error('Cloudinary is not configured. Add cloud name and unsigned upload preset in .env.');
  if (!isImageFile(file) && !isVideoFile(file)) throw new Error('Only image and video files are supported.');

  const resourceType = options.resourceType || (isVideoFile(file) ? 'video' : 'image');
  const url = `https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD_NAME)}/${resourceType}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (options.folder) formData.append('folder', options.folder);

  const response = await fetch(url, { method: 'POST', body: formData });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error?.message || 'Cloudinary upload failed. Check your cloud name and unsigned upload preset.');
  }

  return {
    url: body.secure_url,
    type: resourceType === 'video' ? 'video' : 'image',
    path: body.public_id,
    name: file.name,
    width: body.width || 0,
    height: body.height || 0,
    bytes: body.bytes || file.size || 0,
    format: body.format || ''
  };
}

export async function compressImageToDataUrl(file, settings = POST_IMAGE_SETTINGS) {
  const image = await loadImage(file);
  const { width, height } = containSize(image.naturalWidth || image.width, image.naturalHeight || image.height, settings.maxWidth, settings.maxHeight);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  return canvasToSizedDataUrl(canvas, settings.quality, settings.maxBytes);
}

export async function cropImageFileToDataUrl(file, options = {}) {
  if (!isImageFile(file)) throw new Error('Please choose an image file.');
  const image = await loadImage(file);
  const size = options.size || 360;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;

  const rotation = ((Number(options.rotation || 0) % 360) * Math.PI) / 180;
  const zoom = Math.max(1, Math.min(3, Number(options.zoom || 1)));
  const offsetX = Number(options.offsetX || 0);
  const offsetY = Number(options.offsetY || 0);

  ctx.save();
  ctx.fillStyle = '#11111a';
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
  ctx.rotate(rotation);

  const shortest = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const scale = (size / shortest) * zoom;
  const drawWidth = (image.naturalWidth || image.width) * scale;
  const drawHeight = (image.naturalHeight || image.height) * scale;
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();

  return canvasToSizedDataUrl(canvas, 0.76, MAX_AVATAR_IMAGE_BYTES);
}

function dataUrlToFile(dataUrl, filename) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

function canvasToSizedDataUrl(canvas, startingQuality, maxBytes) {
  let quality = startingQuality;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);

  while (stringBytes(dataUrl) > maxBytes && quality > 0.34) {
    quality -= 0.07;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  if (stringBytes(dataUrl) > maxBytes) {
    throw new Error('Image is still too large. Please crop tighter or choose a smaller image.');
  }

  return dataUrl;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this image. Try JPG, PNG, or WEBP.'));
    };
    image.src = url;
  });
}

function containSize(width, height, maxWidth, maxHeight) {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

function stringBytes(value) {
  return new Blob([value]).size;
}
