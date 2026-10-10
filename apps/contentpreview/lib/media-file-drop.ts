// Browser file drags are separate from the text/plain IDs used to arrange posts.
export function isFileTransfer(transfer: DataTransfer | null) {
  return Boolean(transfer && (Array.from(transfer.types).includes('Files') ||
    Array.from(transfer.items || []).some(item => item.kind === 'file') || transfer.files.length));
}

const mediaTypes: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv', mpeg: 'video/mpeg', mpg: 'video/mpeg', mts: 'video/mp2t',
  m2ts: 'video/mp2t', '3gp': 'video/3gpp', '3g2': 'video/3gpp2', ogv: 'video/ogg',
};

export function prepareDroppedMedia(transfer: DataTransfer) {
  const files: File[] = [];
  const rejected: string[] = [];
  // Read synchronously during drop: the browser clears this store afterwards.
  for (const file of Array.from(transfer.files)) {
    const inferredType = mediaTypes[file.name.split('.').pop()?.toLowerCase() || ''];
    const supported = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.type.startsWith('video/');
    if (!supported && !inferredType) { rejected.push(file.name); continue; }
    files.push(!supported && inferredType
      ? new File([file], file.name, { type: inferredType, lastModified: file.lastModified }) : file);
  }
  return { files, rejected };
}

export function bindMediaFileDrop(
  element: HTMLElement,
  onHover: (active: boolean) => void,
  onDrop: (transfer: DataTransfer) => void,
  windowTarget: Window = window,
) {
  let depth = 0;
  let hovering = false;
  const hover = (active: boolean) => {
    if (hovering !== active) { hovering = active; onHover(active); }
  };
  const reset = () => { depth = 0; hover(false); };
  const enter = (event: DragEvent) => {
    if (!isFileTransfer(event.dataTransfer)) return;
    event.preventDefault(); event.stopPropagation(); depth++; hover(true);
  };
  const over = (event: DragEvent) => {
    if (!isFileTransfer(event.dataTransfer)) return;
    event.preventDefault(); event.stopPropagation(); event.dataTransfer!.dropEffect = 'copy'; hover(true);
  };
  const leave = (event: DragEvent) => {
    if (!isFileTransfer(event.dataTransfer)) return;
    event.stopPropagation(); depth = Math.max(0, depth - 1);
    if (!depth) hover(false);
  };
  const drop = (event: DragEvent) => {
    if (!isFileTransfer(event.dataTransfer)) return;
    event.preventDefault(); event.stopPropagation(); reset(); onDrop(event.dataTransfer!);
  };
  // A missed drop must never replace the workspace with a local file.
  const outside = (event: DragEvent) => {
    if (!isFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    if (event.type === 'dragover') event.dataTransfer!.dropEffect = 'none';
    reset();
  };
  element.addEventListener('dragenter', enter);
  element.addEventListener('dragover', over);
  element.addEventListener('dragleave', leave);
  element.addEventListener('drop', drop);
  windowTarget.addEventListener('dragover', outside);
  windowTarget.addEventListener('drop', outside);
  windowTarget.addEventListener('dragend', reset);
  windowTarget.addEventListener('blur', reset);
  return () => {
    element.removeEventListener('dragenter', enter);
    element.removeEventListener('dragover', over);
    element.removeEventListener('dragleave', leave);
    element.removeEventListener('drop', drop);
    windowTarget.removeEventListener('dragover', outside);
    windowTarget.removeEventListener('drop', outside);
    windowTarget.removeEventListener('dragend', reset);
    windowTarget.removeEventListener('blur', reset);
  };
}
