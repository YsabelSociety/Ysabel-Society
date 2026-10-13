export type PreviewView = 'mobile' | 'desktop' | 'grid';
// Phones stay mobile in landscape too; narrow desktop windows use the compact view.
export const MOBILE_PREVIEW_QUERY = '(max-width: 760px), (hover: none) and (pointer: coarse) and (max-width: 1024px)';
export const defaultPreviewView = (mobile: boolean): PreviewView => mobile ? 'mobile' : 'desktop';
export const allowedPreviewView = (requested: PreviewView, mobile: boolean): PreviewView => mobile ? 'mobile' : requested;
