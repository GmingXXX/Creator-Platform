import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeAppearance } from './components/AppearanceToggle';
import './styles/base.css';
import './styles/shell.css';
import './styles/home.css';
import './styles/appearance.css';
import './styles/ab-fusion.css';

initializeAppearance();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
