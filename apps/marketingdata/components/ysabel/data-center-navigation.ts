export type DataCenterSection = 'refresh' | 'reports' | 'access';
export function openDataCenter(section: DataCenterSection = 'refresh') {
  window.dispatchEvent(new CustomEvent('ysabel:open-data-center', { detail: section }));
}
