// index.js actualizado con soporte API + mejoras de seguridad

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import rateLimit from 'express-rate-limit';
import supabase from './supabaseClient.js';
//import { generalLimiter, securityHeaders } from './middleware/security.js';
import logger from './utils/logger.js';


// Rutas existentes
import tiemposMejorados from './routes/tiemposMejorados.js';
import adminRoutes from './routes/admin.js';
// import rankingRoutes from './routes/ranking.js';
import commitRankingRoutes from './routes/commit_ranking.js';
import telegramRoutes from './routes/telegram.js';
import checkMejoras from './routes/checkMejoras.js';
import rankingAnualRouter from './routes/rankingAnual.js';
import configuracionRouter from './routes/configuracion.js';

// NUEVAS RUTAS - API híbrida
import tiemposHibrido from './routes/tiempos-hibrido.js';
import apiConfiguration from './routes/api-configuration.js';
import healthRoutes from './routes/health.js';

// Servicios
import './services/bot.js';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────── MIDDLEWARE DE SEGURIDAD ───────────

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: { error: 'Demasiadas solicitudes, intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting para alta de jugadores
const altaJugadorLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 registros por hora por IP
  message: { error: 'Límite de registros alcanzado. Intenta de nuevo en una hora.' },
  skipSuccessfulRequests: true,
});

// Rate limiting para APIs de scraping
const scrapingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 requests por IP
  message: { error: 'Demasiadas consultas de datos. Espera 5 minutos.' },
});

// Headers de seguridad
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://js.hcaptcha.com https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https:; " +
    "frame-src 'self' https://hcaptcha.com;"
  );
  next();
}

// Validación de entrada
function validateInput(req, res, next) {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .trim()
          .substring(0, 1000);
      }
    });
  }
  next();
}

// Aplicar middleware
app.use(securityHeaders);
app.use(generalLimiter);
app.use(validateInput);

// ─────────── MIDDLEWARE BÁSICO ───────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─────────── HEALTH CHECKS ───────────
app.use('/api', healthRoutes);

// ─────────── RUTA DE ALTA DE JUGADOR ───────────
app.post('/api/alta-jugador', altaJugadorLimiter, async (req, res) => {
  const { nombre, token } = req.body;

  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    return res.status(400).json({ error: 'Nombre inválido.' });
  }
  if (!token) {
    return res.status(400).json({ error: 'Captcha obligatorio.' });
  }

  try {
    // Verificar hCaptcha
    const captchaResponse = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.HCAPTCHA_SECRET,
        response: token
      })
    });
    const captcha = await captchaResponse.json();
    if (!captcha.success) {
      return res.status(403).json({ error: 'Captcha inválido.' });
    }
  } catch (err) {
    console.error('Error verificando hCaptcha:', err);
    return res.status(500).json({ error: 'Error al verificar el captcha.' });
  }

  try {
    // Comprueba si ya existe el jugador
    const { data: existe, error: errorSelect } = await supabase
      .from('jugadores')
      .select('id')
      .eq('nombre', nombre.trim())
      .maybeSingle();

    if (errorSelect) {
      console.error('Error al buscar jugador existente →', errorSelect.message);
      return res.status(500).json({ error: errorSelect.message });
    }
    if (existe) {
      return res.status(400).json({ error: 'El jugador ya existe.' });
    }

    // Inserta el nuevo jugador
    const { error } = await supabase
      .from('jugadores')
      .insert([{ nombre: nombre.trim() }]);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Error al registrar jugador:', err);
    res.status(500).json({ error: 'Error inesperado en el servidor.' });
  }
});

// ─────────── RUTAS EXISTENTES ───────────
app.use(scrapingLimiter); // Rate limit para APIs de datos
app.use(tiemposMejorados);
app.use(adminRoutes);
app.use(rankingRoutes);
app.use(commitRankingRoutes);
app.use(telegramRoutes);
app.use(checkMejoras);
app.use(rankingAnualRouter);
app.use(configuracionRouter);
app.use(securityHeaders);
app.use(generalLimiter);
app.use(logger.expressMiddleware());
app.use('/api', healthRoutes);

// ─────────── NUEVAS RUTAS API HÍBRIDA ───────────
app.use(tiemposHibrido);
app.use(apiConfiguration);

// ─────────── CONFIGURACIÓN SUPABASE ───────────
app.get('/api/supabase-credentials', (req, res) => {
  res.json({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY
  });
});

// ─────────── INFORMACIÓN DE LA APLICACIÓN ───────────
app.get('/api/app-info', (req, res) => {
  res.json({
    name: 'Liga Velocidrone',
    version: '2.0.0',
    features: {
      scraping: true,
      api: !!process.env.VELOCIDRONE_API_TOKEN,
      telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
      health_monitoring: true,
      rate_limiting: true
    },
    endpoints: {
      legacy: '/api/tiempos-mejorados',
      hybrid: '/api/tiempos-hibrido',
      health: '/api/health',
      detailed_health: '/api/health/detailed'
    }
  });
});

// ─────────── INICIAR SERVIDOR ───────────
app.listen(PORT, () => {
  console.log(`🚀 Servidor Liga Velocidrone iniciado en puerto ${PORT}`);
  console.log(`📡 API Velocidrone: ${process.env.VELOCIDRONE_API_TOKEN ? '✅ Configurada' : '❌ No configurada'}`);
  console.log(`🤖 Bot Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Activo' : '❌ No configurado'}`);
  console.log(`🔐 hCaptcha: ${process.env.HCAPTCHA_SECRET ? '✅ Configurado' : '❌ No configurado'}`);
});