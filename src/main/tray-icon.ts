import { nativeImage, type NativeImage } from 'electron';

/** Embedded 1×1 PNG so the tray works without shipping binary assets. */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export function createTrayImage(): NativeImage {
  return nativeImage.createFromBuffer(PNG_1PX);
}
