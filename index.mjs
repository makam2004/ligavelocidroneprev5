import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
// import dotenv from 'dotenv';        // <-- si no lo usas, puedes dejarlo así comentado
import adminRoutes from './routes/admin.js';
import tiemposRoutes from './routes/tiemposMejorados.js';
import configRoutes from './routes/configuracion.js';
// (Si tienes más rutas, impórtalas aquí)

// dotenv.config();                   // <-- si quieres cargar .env, comenta así

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());         // parse application/json
app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded

// Servir archivos estáticos (HTML, CSS, JS del front)
app.use(express.static(path.join(__dirname, 'public')));

// Rutas
app.use(adminRoutes);            // /admin/update-tracks
app.use(tiemposRoutes);          // /api/tiempos-mejorados
app.use(configRoutes);           // /api/obtener-config  (¡esto es necesario!)

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
