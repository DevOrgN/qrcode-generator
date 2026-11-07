import QRCode from 'qrcode';

export const DEFAULT_OPTIONS = Object.freeze({
  foreground: '#18181b',
  background: '#ffffff',
  size: 1024,
  errorCorrectionLevel: 'H',
  margin: 4,
});

const MAX_LOGO_BYTES = 20 * 1024 * 1024;
const MAX_LOGO_EDGE = 16384;
const MAX_LOGO_PIXELS = 64_000_000;
const MAX_LOGO_FRACTION = 0.22;
const CAPACITY_BYTES = Object.freeze({ L: 2953, M: 2331, Q: 1663, H: 1273 });
const MIME_BY_SIGNATURE = { png: 'image/png', jpeg: 'image/jpeg' };

function utf8Bytes(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8');
  throw new Error('This browser does not support UTF-8 text encoding.');
}

export function byteLength(text) {
  return utf8Bytes(String(text)).length;
}

function levelKey(level) {
  return String(level || 'H').toUpperCase();
}

export function validateText(text, level = 'H') {
  const bytes = typeof text === 'string' ? byteLength(text) : 0;
  const maxBytes = CAPACITY_BYTES[levelKey(level)] ?? CAPACITY_BYTES.H;
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { valid: false, error: 'Enter text or a URL to create a QR code.', bytes, maxBytes };
  }
  if (!CAPACITY_BYTES[levelKey(level)]) {
    return { valid: false, error: 'Choose a supported error correction level (L, M, Q, or H).', bytes, maxBytes };
  }
  try {
    // qrcode performs the authoritative segmentation and version-capacity check.
    QRCode.create(text, { errorCorrectionLevel: levelKey(level) });
    return { valid: true, error: null, bytes, maxBytes };
  } catch {
    return {
      valid: false,
      error: `This text is too long for a QR code at ${levelKey(level)} correction (${bytes} UTF-8 bytes; maximum ${maxBytes} bytes).`,
      bytes,
      maxBytes,
    };
  }
}

function declaredMime(file) {
  return String(file?.type || '').toLowerCase();
}

export function validateLogo(file) {
  if (!file) return 'Choose a PNG or JPEG image.';
  const mime = declaredMime(file);
  const imageExtension = /\.(png|jpe?g)$/i.test(file.name || '');
  const allowed = ['', 'application/octet-stream', 'binary/octet-stream', 'image/png', 'image/x-png', 'image/jpeg', 'image/jpg'];
  // The signature below is authoritative; MIME metadata is often absent or generic.
  if (!allowed.includes(mime) && !imageExtension) return 'Choose a PNG or JPG image.';
  if (!Number.isFinite(file.size) || file.size <= 0) return 'This file is empty or unreadable.';
  if (file.size > MAX_LOGO_BYTES) return 'Choose an image smaller than 20 MB.';
  return null;
}

function asBytes(buffer) {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function detectImage(bytes) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { type: 'png', mime: MIME_BY_SIGNATURE.png, width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) break;
        return { type: 'jpeg', mime: MIME_BY_SIGNATURE.jpeg, height: (bytes[offset + 3] << 8) | bytes[offset + 4], width: (bytes[offset + 5] << 8) | bytes[offset + 6] };
      }
      offset += length;
    }
  }
  return null;
}

function checkDimensions(info) {
  return Number.isInteger(info?.width) && Number.isInteger(info?.height) && info.width > 0 && info.height > 0 &&
    info.width <= MAX_LOGO_EDGE && info.height <= MAX_LOGO_EDGE && info.width * info.height <= MAX_LOGO_PIXELS;
}

function bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  throw new Error('This browser cannot encode the selected logo.');
}

function fileDataUrl(bytes, mime) {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

// Return representative source pixels, never rounded bins or averaged colors.
export function extractLogoColors(pixels, maximum = 5) {
  const count = minimumAlpha => {
    const counts = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < minimumAlpha) continue;
      const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      counts.set(key, (counts.get(key) || 0) + pixels[i + 3] / 255);
    }
    return counts;
  };
  let counts = count(240);
  if (!counts.size) counts = count(48);
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  // Rank color families together, but display their most frequent original pixel.
  // This handles JPEG noise and gradients without synthesizing a rounded swatch.
  const families = new Map();
  for (const [color, frequency] of counts) {
    const key = ((color >> 21) << 6) | (((color >> 13) & 7) << 3) | ((color >> 5) & 7);
    const family = families.get(key) || { color, weight: 0, frequency: 0 };
    family.weight += frequency;
    if (frequency > family.frequency) { family.color = color; family.frequency = frequency; }
    families.set(key, family);
  }
  const eligible = [...families.values()]
    // Only omit white and near-white artwork. Saturated brand colors such as gold
    // can be useful QR foregrounds even when they do not meet text contrast rules.
    .filter(({ color }) => luminance(`#${color.toString(16).padStart(6, '0')}`) < 0.85)
    .sort((a, b) => b.weight - a.weight || b.frequency - a.frequency);
  const chosen = [];
  for (const { color, weight } of eligible) {
    if (weight < total * 0.0025) continue;
    const rgb = [color >> 16, (color >> 8) & 255, color & 255];
    if (chosen.some(item => item.rgb.reduce((sum, channel, index) => sum + (channel - rgb[index]) ** 2, 0) < 36 ** 2)) continue;
    chosen.push({ rgb, hex: `#${color.toString(16).padStart(6, '0')}` });
    if (chosen.length === maximum) break;
  }
  return chosen.map(item => item.hex);
}

function colorPalette(image) {
  const ratio = Math.min(1, 384 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return extractLogoColors(context.getImageData(0, 0, canvas.width, canvas.height).data);
}

export async function loadLogo(file) {
  const error = validateLogo(file);
  if (error) throw new Error(error);
  let source;
  try {
    source = asBytes(await file.arrayBuffer());
  } catch {
    throw new Error('Could not read the selected logo. Choose the image again.');
  }
  const info = detectImage(source);
  if (!info) throw new Error('The file content is not a supported PNG or JPEG image.');
  if (!checkDimensions(info)) throw new Error('This image is too large to open safely. Choose an image under 64 megapixels.');
  const sourceUrl = fileDataUrl(source, info.mime);
  if (typeof Image === 'undefined') return { dataUrl: sourceUrl, width: info.width, height: info.height, colors: [] };
  const image = await loadImage(sourceUrl);
  // Browser decoding applies image orientation. Do not reject valid oriented images
  // because their decoded width/height differ from the file header.
  const colors = colorPalette(image);
  const ratio = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the image. Try another browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  // Trim only transparent pixels; preserve white artwork and internal transparency.
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
    if (pixels[(y * canvas.width + x) * 4 + 3] > 8) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('This image is completely transparent. Choose a visible logo.');
  const cropped = document.createElement('canvas');
  cropped.width = right - left + 1; cropped.height = bottom - top + 1;
  cropped.getContext('2d').drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return { dataUrl: cropped.toDataURL('image/png'), width: cropped.width, height: cropped.height, colors };
}

function parseHexColor(value, name) {
  const color = String(value ?? '').trim();
  if (/^#[\da-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map((c) => c + c).join('')}`.toLowerCase();
  if (/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase();
  throw new Error(`${name} must be a 3- or 6-digit hex color (for example #18181b).`);
}

function rgb(color) {
  const hex = parseHexColor(color, 'Color').slice(1);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function luminance(color) {
  const channels = rgb(color).map((channel) => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function xmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&apos;');
}

function imageInfoFromDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg));base64,([\da-z+/=]+)$/i.exec(String(dataUrl));
  if (!match) throw new Error('Logo data must be a base64 PNG or JPEG image. Remove the logo and select it again.');
  let decoded;
  try {
    if (typeof atob === 'function') decoded = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    else decoded = new Uint8Array(Buffer.from(match[2], 'base64'));
  } catch { throw new Error('Logo image data is invalid. Remove the logo and select it again.'); }
  if (decoded.length > MAX_LOGO_BYTES) throw new Error('Logo must be 20 MB or smaller.');
  const info = detectImage(decoded);
  if (!info || info.mime !== match[1].toLowerCase() || !checkDimensions(info)) {
    throw new Error('Logo image content or dimensions are invalid. Choose a PNG or JPEG within the size limits.');
  }
  return info;
}

function logoSvg(dataUrl, size) {
  const info = imageInfoFromDataUrl(dataUrl);
  const edge = size * MAX_LOGO_FRACTION;
  const ratio = Math.min(edge / info.width, edge / info.height);
  const width = info.width * ratio, height = info.height * ratio;
  const x = (size - width) / 2, y = (size - height) / 2;
  return `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${xmlEscape(dataUrl)}"/>`;
}

async function prepareLogo(dataUrl) {
  const image = await loadImage(dataUrl);
  const width = image.naturalWidth, height = image.naturalHeight;
  const source = document.createElement('canvas');
  source.width = width; source.height = height;
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  sourceContext.drawImage(image, 0, 0);
  const padding = Math.max(2, Math.ceil(Math.min(width, height) * 0.035));
  const output = document.createElement('canvas');
  output.width = width + padding * 2; output.height = height + padding * 2;
  const context = output.getContext('2d');
  // Keep QR modules out of fine or transparent artwork with a compact solid backing.
  // Its bounds follow the cropped artwork aspect ratio instead of expanding to a square.
  const radius = Math.min(padding, Math.min(width, height) * 0.12);
  context.fillStyle = '#fff';
  context.beginPath();
  context.roundRect(0, 0, output.width, output.height, radius);
  context.fill();
  context.drawImage(source, padding, padding);
  return output.toDataURL('image/png');
}

function addLogoToSvg(svg, logo, size) {
  if (!logo) return svg;
  // qrcode's SVG coordinates are modules even when width/height are pixels.
  const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!viewBox || Number(viewBox[1]) !== Number(viewBox[2])) {
    throw new Error('The QR vector layout could not be read.');
  }
  const coordinateSize = Number(viewBox[1]);
  const content = `<g transform="scale(${coordinateSize / size})">${logoSvg(logo, size)}</g>`;
  return svg.replace(/<\/svg>\s*$/i, `${content}</svg>`);
}

function loadImage(dataUrl) {
  if (typeof Image === 'undefined') return Promise.reject(new Error('Logo rendering requires a browser with image support.'));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected logo could not be decoded. Choose another PNG or JPEG.'));
    image.src = dataUrl;
  });
}

async function rasterWithLogo(dataUrl, logo, size) {
  const qrImage = await loadImage(dataUrl);
  const logoImage = await loadImage(logo);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG export is unavailable because canvas could not be created.');
  context.drawImage(qrImage, 0, 0, size, size);
  const edge = size * MAX_LOGO_FRACTION;
  const ratio = Math.min(edge / logoImage.naturalWidth, edge / logoImage.naturalHeight);
  const width = logoImage.naturalWidth * ratio, height = logoImage.naturalHeight * ratio;
  context.drawImage(logoImage, size / 2 - width / 2, size / 2 - height / 2, width, height);
  return canvas.toDataURL('image/png');
}

function rasterQR(text, options) {
  const matrix = QRCode.create(text, { errorCorrectionLevel: options.level });
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = options.size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PNG export is unavailable because canvas could not be created.');
  context.fillStyle = options.background;
  context.fillRect(0, 0, options.size, options.size);

  // Paint module runs directly onto the requested integer canvas. qrcode's
  // browser renderer floors its scaled canvas dimension, which can drop the
  // final pixel at otherwise valid export sizes.
  const modules = matrix.modules;
  const total = modules.size + options.margin * 2;
  const scale = options.size / total;
  context.fillStyle = options.foreground;
  for (let row = 0; row < modules.size; row += 1) {
    let start = -1;
    for (let column = 0; column <= modules.size; column += 1) {
      const dark = column < modules.size && modules.data[row * modules.size + column];
      if (dark && start < 0) start = column;
      if (!dark && start >= 0) {
        const left = Math.floor((options.margin + start) * scale);
        const right = Math.floor((options.margin + column) * scale);
        const top = Math.floor((options.margin + row) * scale);
        const bottom = Math.floor((options.margin + row + 1) * scale);
        context.fillRect(left, top, right - left, bottom - top);
        start = -1;
      }
    }
  }
  return canvas.toDataURL('image/png');
}

export async function generateQR(text, options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  const level = settings.logo ? 'H' : levelKey(settings.errorCorrectionLevel);
  const validation = validateText(text, level);
  if (!validation.valid) throw new Error(validation.error);
  const size = Number(settings.size);
  if (![512, 1024, 2048].includes(size)) throw new Error('QR image size must be 512, 1024, or 2048 pixels.');
  const foreground = parseHexColor(settings.foreground, 'Foreground color');
  const background = parseHexColor(settings.background, 'Background color');
  const margin = Math.max(4, Number.isFinite(Number(settings.margin)) ? Math.floor(Number(settings.margin)) : 4);
  const qrOptions = { errorCorrectionLevel: level, margin, width: size, color: { dark: foreground, light: background } };
  let logo = settings.logo || null;
  if (logo) imageInfoFromDataUrl(logo);
  let svg;
  try { svg = await QRCode.toString(text, { ...qrOptions, type: 'svg' }); }
  catch { throw new Error('Could not generate this QR code. Shorten the text or choose a supported correction level.'); }
  const dataUrl = typeof document !== 'undefined'
    ? rasterQR(text, { level, margin, size, foreground, background })
    : await QRCode.toDataURL(text, { ...qrOptions, type: 'image/png' });
  if (logo) {
    if (typeof document === 'undefined') throw new Error('PNG export with a logo requires a browser canvas.');
    logo = await prepareLogo(logo);
    const png = await rasterWithLogo(dataUrl, logo, size);
    svg = addLogoToSvg(svg, logo, size);
    return { dataUrl: png, svg, size, bytes: validation.bytes, modules: QRCode.create(text, { errorCorrectionLevel: level }).modules.size };
  }
  return { dataUrl, svg, size, bytes: validation.bytes, modules: QRCode.create(text, { errorCorrectionLevel: level }).modules.size };
}

function requireBrowserAction(name) {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') {
    throw new Error(`${name} is not supported in this environment.`);
  }
}

function dataUrlBlob(dataUrl) {
  const [header, payload] = dataUrl.split(',', 2);
  const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/png';
  const binary = typeof atob === 'function' ? atob(payload) : Buffer.from(payload, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function downloadQR(result, format = 'png') {
  if (!result) throw new Error('Create a QR code before downloading.');
  const kind = String(format).toLowerCase();
  if (kind !== 'png' && kind !== 'svg') throw new Error('Unsupported export format. Choose PNG or SVG.');
  requireBrowserAction('Downloading QR codes');
  let blob, extension;
  if (kind === 'png') { blob = dataUrlBlob(result.dataUrl); extension = 'png'; }
  else if (kind === 'svg') { blob = new Blob([result.svg], { type: 'image/svg+xml;charset=utf-8' }); extension = 'svg'; }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `qr-code.${extension}`; link.style.display = 'none';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyQR(result) {
  if (!result) throw new Error('Create a QR code before copying.');
  if (!globalThis.navigator?.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Image copy is not supported here. Use Download PNG instead.');
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': dataUrlBlob(result.dataUrl) })]);
  } catch (error) {
    if (error?.name === 'NotAllowedError') throw new Error('Clipboard access was denied. Allow clipboard access or download the PNG.');
    throw new Error('Could not copy the QR image. Try downloading the PNG instead.');
  }
}

export function canShareQR(result) {
  if (!result || typeof navigator === 'undefined' || typeof navigator.share !== 'function' || typeof File === 'undefined') return false;
  try {
    const file = new File([dataUrlBlob(result.dataUrl)], 'qr-code.png', { type: 'image/png' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch { return false; }
}

export async function shareQR(result) {
  if (!result) throw new Error('Create a QR code before sharing.');
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    throw new Error('Sharing is not supported here. Download the PNG to share it manually.');
  }
  if (typeof File === 'undefined') throw new Error('Sharing image files is not supported here. Download the PNG to share it manually.');
  const file = new File([dataUrlBlob(result.dataUrl)], 'qr-code.png', { type: 'image/png' });
  const payload = { title: 'QR code', files: [file] };
  if (navigator.canShare && !navigator.canShare(payload)) {
    throw new Error('This device cannot share QR image files. Download the PNG to share it manually.');
  }
  try { await navigator.share(payload); return true; }
  catch (error) {
    if (error?.name === 'AbortError') return false;
    throw new Error('Could not share the QR image. Try downloading the PNG instead.');
  }
}
