import { NativeModules } from 'react-native';

const bytesToBase64 = (bytes) => {
  const chunkSize = 0x2000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

const textToBase64 = (value) => {
  const bytes = new TextEncoder().encode(String(value ?? ''));
  return bytesToBase64(bytes);
};

export async function saveExportFile(filename, mimeType, contents) {
  const exporter = NativeModules.FileExport;
  if (!exporter?.saveToDownloads) {
    throw new Error('File export is not available in this app build. Rebuild the Android app and try again.');
  }
  const base64 = typeof contents === 'string'
    ? textToBase64(contents)
    : bytesToBase64(contents);
  const savedName = await exporter.saveToDownloads(filename, mimeType, base64);
  return savedName || filename;
}
