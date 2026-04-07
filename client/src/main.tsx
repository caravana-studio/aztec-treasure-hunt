import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WalletProvider } from './context/WalletContext';
import './styles/index.css';
import './styles/glass.css';
import './styles/game.css';
import './styles/clouds.css';
import './styles/lobby.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);
