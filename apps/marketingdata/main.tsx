import { createRoot } from 'react-dom/client';
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/geist/latin-700.css';
import './app/globals.css';
import Workspace from './components/ysabel/workspace';

const pathname = window.location.pathname.replace(/\/$/, '');
const initialPage = pathname.endsWith('/admin') ? 'Admin Panel'
  : pathname.endsWith('/connections') ? 'Connections' : 'Overview';
createRoot(document.getElementById('root')!).render(<Workspace initialPage={initialPage} />);
