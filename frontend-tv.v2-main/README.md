# Frontend TV v2

Aplicación React (Vite) que consume la API unificada de la plataforma bajo `http://localhost:3000/api/v1`.

## Requisitos

- Node.js 18 o superior
- npm 9+

## Configuración inicial

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Configura las variables de entorno creando un archivo `.env` en la raíz con:

   ```env
   VITE_API_BASE_URL=http://localhost:3000/api/v1
   ```

   Esta URL es utilizada por todos los servicios del frontend para comunicarse con el backend. No se requiere ningún proxy adicional.

## Scripts disponibles

- `npm run dev`: levanta el entorno de desarrollo en `http://localhost:5173`.
- `npm run build`: genera el build de producción.
- `npm run preview`: sirve el build generado.

## Consumo de API

Todas las solicitudes se realizan usando la variable `VITE_API_BASE_URL`. Algunos endpoints relevantes del backend expuestos bajo `/api/v1` son:

- `GET /auth/me`
- `POST /auth/login`
- `GET /channels`
- `GET /titans/services?host=<IP>&path=/services`
- `GET /titans/services/multi?hosts=ip1,ip2&path=/services`

Ejemplo rápido con `curl` desde el navegador (reemplaza `<IP>` con el host Titan que necesites consultar):

```bash
curl "http://localhost:3000/api/v1/titans/services?host=<IP>&path=/services"
```

## Notas

- El frontend ya no usa proxies ni rutas `/proxy/*`; todas las llamadas pasan por el backend.
- Para habilitar credenciales (cookies) la instancia Axios se crea con `withCredentials: true`.
- Asegúrate de levantar el backend (`PORT=3000`) antes de iniciar el frontend para evitar errores de conexión.
