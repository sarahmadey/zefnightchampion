import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { startCloud } from './state/cloud';

// inside the claude.ai viewer, progress also lives online (see state/cloud.ts)
void startCloud();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
