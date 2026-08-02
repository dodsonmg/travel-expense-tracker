// Shared by ExportView and BackupPanel: share via the Web Share API (mobile
// share sheet) when available, falling back to a plain download.

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Downloads if the Web Share API/file sharing isn't available, or if the
// user cancels/it fails. Returns which one actually happened, so the caller
// can show the right status message.
export async function shareBlob(
  blob: Blob,
  name: string,
  type: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], name, { type });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  downloadBlob(blob, name);
  return 'downloaded';
}
