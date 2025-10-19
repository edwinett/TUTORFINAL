// Funciones de codificación y decodificación de audio para la API Gemini Live

/**
 * Decodifica una cadena base64 a un Uint8Array.
 * NO uses librerías externas como js-base64.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Codifica un Uint8Array a una cadena base64.
 * NO uses librerías externas como js-base64.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodifica datos de audio PCM en bruto a un AudioBuffer que puede ser reproducido.
 * La API Live devuelve audio PCM en bruto, no un formato de archivo estándar como .wav o .mp3.
 * NO uses el método nativo AudioContext.decodeAudioData que está diseñado para archivos completos.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
