import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadDictionary } from './lib/gameLogic';

// Load the full dictionary before rendering so isWord() works everywhere
loadDictionary().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
