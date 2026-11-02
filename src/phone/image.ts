/** Lädt ein Bild (Datei oder data-URL) und liefert ein verkleinertes JPEG als base64 ohne Präfix. */
export async function toJpegBase64(src: Blob | string, maxSide = 2000): Promise<{ base64: string; dataUrl: string }> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Bild konnte nicht gelesen werden (Format?).'))
      i.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Bildverarbeitung nicht verfügbar.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    return { base64: dataUrl.slice(dataUrl.indexOf(',') + 1), dataUrl }
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url)
  }
}
