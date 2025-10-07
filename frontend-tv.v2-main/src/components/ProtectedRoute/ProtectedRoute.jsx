import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../utils/api";

export default function ProtectedRoute() {
  const [ok, setOk] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const response = await api.profile();
        if (mounted) setOk(true);
      } catch (error) {
        if (mounted) {
          setOk(false);
          setError(error?.response?.data?.error || 'No autorizado');
        }
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  if (ok === null) return <div style={{ padding: 16 }}>Verificando sesión...</div>;

  if (error && error.includes('token_expired')) {
    return <div style={{ padding: 16 }}>Sesión expirada, redirigiendo...</div>;
  }

  return ok ? <Outlet /> : <Navigate to="/auth/login" replace />;
}