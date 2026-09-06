import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import './styles.css';
import YsabelWorkspace from './components/ysabel-workspace';

createRoot(document.getElementById('root')!).render(<StrictMode><YsabelWorkspace /></StrictMode>);
