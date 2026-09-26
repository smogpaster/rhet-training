// PCM (16 kHz, 16 Bit, mono) → WAV-Datei. Das ist das Format, das die Brille liefert.
export const SAMPLE_RATE = 16000
export const BYTES_PER_SECOND = SAMPLE_RATE * 2

export function pcmToWav(chunks: Uint8Array[]): Blob {
  const dataLength = chunks.reduce((n, c) => n + c.byteLength, 0)
  const header = new ArrayBuffer(44)
  const v = new DataView(header)
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + dataLength, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true) // Länge des fmt-Blocks
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, SAMPLE_RATE, true)
  v.setUint32(28, BYTES_PER_SECOND, true)
  v.setUint16(32, 2, true) // Block-Alignment
  v.setUint16(34, 16, true) // Bits pro Sample
  str(36, 'data')
  v.setUint32(40, dataLength, true)
  return new Blob([header, ...(chunks as BlobPart[])], { type: 'audio/wav' })
}

export function pcmDurationSec(byteLength: number): number {
  return byteLength / BYTES_PER_SECOND
}
