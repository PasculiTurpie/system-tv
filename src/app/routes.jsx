import { lazy } from 'react';
import { Route, Routes as RouterRoutes, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore.js';

const ChannelList = lazy(() => import('../pages/ChannelList.jsx'));
const DiagramEditor = lazy(() => import('../pages/ChannelEditor/DiagramEditor.jsx'));

export default function Routes() {
  const { isAuthenticated } = useAuthStore();

  return (
    <RouterRoutes>
      <Route path="/" element={<ChannelList />} />
      <Route
        path="/channels/:channelId"
        element={isAuthenticated ? <DiagramEditor /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </RouterRoutes>
  );
}
