import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import VerifyPage from './pages/VerifyPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/verify/:boxId" element={<VerifyPage />} />
    </Routes>
  );
}

