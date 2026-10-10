import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { bindMediaFileDrop, prepareDroppedMedia } from '@/lib/media-file-drop';

export default function MediaFileDrop({ as: Tag = 'section', className, style, onFiles, children }: {
  as?: 'section' | 'aside'; className: string; style?: CSSProperties;
  onFiles: (files: File[]) => void; children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const receiveFiles = useRef(onFiles);
  const [hovering, setHovering] = useState(false);
  const [notice, setNotice] = useState('');
  useLayoutEffect(() => { receiveFiles.current = onFiles; }, [onFiles]);
  useEffect(() => {
    if (!root.current) return;
    return bindMediaFileDrop(root.current, setHovering, transfer => {
      const { files, rejected } = prepareDroppedMedia(transfer);
      setNotice(rejected.length
        ? `Skipped ${rejected.length} unsupported item${rejected.length === 1 ? '' : 's'}. Drop JPG, PNG, WEBP or video files, not folders.`
        : !files.length ? 'Drop the photo or video files themselves, not a folder.' : '');
      if (files.length) receiveFiles.current(files);
    });
  }, []);
  return <Tag ref={root} className={`${className} media-file-drop${hovering ? ' is-file-over' : ''}`} style={style}>
    {hovering && <div className="media-file-drop-overlay" role="status"><div><Upload /><strong>Drop to add media</strong><span>Photos & videos · Multiple files welcome</span></div></div>}
    {children}
    {notice && <div className="media-file-drop-notice" role="alert"><span>{notice}</span><button type="button" aria-label="Dismiss upload notice" onClick={() => setNotice('')}><X size={16} /></button></div>}
  </Tag>;
}
