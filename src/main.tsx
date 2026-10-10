import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './hooks/useTheme';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider><App /></ThemeProvider>,
);
