/** Datei teilen: Teilen-Dialog mit Datei, sonst Text, sonst Zwischenablage. Liefert eine Rückmeldung. */
export async function shareFile(content: string, fileName: string, mime: string): Promise<string> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean }
  try {
    if (nav.share) {
      const file = new File([content], fileName, { type: mime })
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: fileName })
        return 'Geteilt.'
      }
      await nav.share({ title: fileName, text: content })
      return 'Geteilt.'
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return ''
  }
  // Desktop-Browser: Download anbieten
  try {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return `Als Datei „${fileName}“ gespeichert.`
  } catch {
    /* weiter zur Zwischenablage */
  }
  try {
    await navigator.clipboard.writeText(content)
    return 'Kein Teilen-Dialog verfügbar, Inhalt in die Zwischenablage kopiert.'
  } catch {
    return 'Teilen nicht möglich.'
  }
}
