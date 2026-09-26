// iOS Safari doesn't reliably honor <a download> — confirmed by a user report on a
// real iPhone (tapping "Descargar" did nothing). Safari there typically just
// navigates to/displays the linked data instead of saving it, especially for large
// data: URIs (a full-resolution scanned page easily runs several MB once
// base64-encoded). The Web Share API's file-sharing opens the native share sheet
// instead, which includes "Guardar en Fotos"/"Guardar en Archivos" and works
// reliably there. Feature-detected via navigator.canShare({ files }) since support
// varies — most desktop browsers lack it entirely, so the classic <a download>
// link (which already works fine on desktop Chrome/Firefox and Android Chrome)
// stays the default there instead of routing everyone through an extra
// share-sheet tap they don't need.
export async function saveOrShareFile(blob, filename, mimeType) {
  const file = new File([blob], filename, { type: mimeType });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user dismissed the share sheet, not a failure
      // Any other failure (older/inconsistent Safari share support, etc.): fall
      // through to the plain download link below rather than leaving the user
      // with nothing.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
