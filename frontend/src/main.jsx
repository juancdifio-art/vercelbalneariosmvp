import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { instalarDetectorDeSesion } from './lib/sesion';

instalarDetectorDeSesion();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
