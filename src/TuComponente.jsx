import React from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import ContratosDetalle from './pages/ContratosDetalle.jsx';
import EstadoDetalle from './pages/EstadoDetalle.jsx';
import BalanceDetalle from './pages/BalanceDetalle.jsx';
import ComprasDetalle from './pages/ComprasDetalle.jsx';
import ProyeccionesDetalle from './pages/ProyeccionesDetalle.jsx';
import './styles/main.css';

// Módulo remoto "Control de Costos" — datos estáticos (JSON regenerados cada
// noche por el proceso local de actualización), sin llamadas en vivo a Sinco.
//
// Usa MemoryRouter (no BrowserRouter) a propósito: este componente se monta
// embebido dentro del shell (vic.icconstructora.co/control/costos), que ya
// tiene su propio router en la URL real del navegador. MemoryRouter mantiene
// un historial de navegación interno y aislado — permite las pantallas de
// detalle (Estado, Balance, Contratos, Compras) sin tocar window.history ni
// pelear con el router del shell.
export default function TuComponente() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/"                      element={<Dashboard />} />
        <Route path="/contratos/:macroKey"   element={<ContratosDetalle />} />
        <Route path="/estado/:macroKey"      element={<EstadoDetalle />} />
        <Route path="/balance/:macroKey"     element={<BalanceDetalle />} />
        <Route path="/compras/:macroKey"      element={<ComprasDetalle />} />
        <Route path="/proyecciones/:macroKey" element={<ProyeccionesDetalle />} />
        <Route path="*"                      element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  );
}
