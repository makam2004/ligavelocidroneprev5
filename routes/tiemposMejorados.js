// routes/tiemposMejorados.js
import express from 'express';
import puppeteer from 'puppeteer';
import supabase from '../supabaseClient.js';
import fetch from 'node-fetch'; // node-fetch v3

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────────
// Función auxiliar: scrapea un track oficial con Puppeteer
//   - Puedes ajustar el contenido de esta función a la implementación que tenías
//   - Debe devolver un array de objetos con { pista, escenario, jugador, tiempo, modelo, pais }
// ─────────────────────────────────────────────────────────────────────────────────
async function obtenerResultadosScrape(escenarioId, pistaId) {
  // Aquí iría tu lógica de Puppeteer tal como la tenías:
  // - Abrir puppeteer
  // - Navegar a la URL construida con escenarioId/pistaId
  // - Extraer los nombres, tiempos, modelos, países, etc.
  // - Cerrar navegador y devolver el array de resultados

  // Ejemplo simplificado (devuelve array vacío para que no rompa):
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────────
// Función auxiliar: consultar la API de Velocidrone para un “track no oficial”
// ─────────────────────────────────────────────────────────────────────────────────
async function obtenerResultadosAPI(trackId, protectedTrackValue, nombreTrack, escenario, raceMode = 3) {
  const simVersion = '1.16'; // Ajustar si tu servidor usa otra versión
  const urlApi = 'https://velocidrone.co.uk/api/leaderboard';
  const postData =
    `track_id=${trackId}` +
    `&sim_version=${simVersion}` +
    `&offset=0` +
    `&count=3` +                // Top 3 tiempos
    `&race_mode=${raceMode}` +  // 3 = 1 vuelta
    `&protected_track_value=${protectedTrackValue ? 1 : 0}`;

  const response = await fetch(urlApi, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VELO_API_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `post_data=${encodeURIComponent(postData)}`
  });

  if (!response.ok) {
    console.error(`❌ Error API Velocidrone (track ${trackId}):`, response.status, await response.text());
    return [];
  }

  const data = await response.json();
  if (!data.tracktimes || data.tracktimes.length === 0) return [];

  // Mapear cada entrada al formato que usa el front-end
  return data.tracktimes.map(r => ({
    pista:     nombreTrack,
    escenario: escenario,
    jugador:   r.playername,
    tiempo:    r.lap_time,
    modelo:    r.model_name,
    pais:      r.country
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────
// Ruta: GET /api/tiempos-mejorados
// ─────────────────────────────────────────────────────────────────────────────────
router.get('/api/tiempos-mejorados', async (req, res) => {
  try {
    // 1) Obtener la fila de configuración (id = 1)
    const { data: config, error: errConf } = await supabase
      .from('configuracion')
      .select(`
        track1_escena,
        track1_pista,
        track2_escena,
        track2_pista,

        trackUnof1_id,
        trackUnof1_protected,
        trackUnof1_nombre,
        trackUnof1_escenario,

        trackUnof2_id,
        trackUnof2_protected,
        trackUnof2_nombre,
        trackUnof2_escenario
      `)
      .eq('id', 1)
      .single();
    if (errConf) throw errConf;
    if (!config) return res.json([]);

    // 2) Arreglo donde acumularemos todos los resultados
    const todo = [];

    // ———————————— A) Scraping para tracks oficiales ————————————
    if (config.track1_escena && config.track1_pista) {
      const resultados1 = await obtenerResultadosScrape(
        config.track1_escena,
        config.track1_pista
      );
      resultados1.forEach(r => todo.push(r));
    }
    if (config.track2_escena && config.track2_pista) {
      const resultados2 = await obtenerResultadosScrape(
        config.track2_escena,
        config.track2_pista
      );
      resultados2.forEach(r => todo.push(r));
    }

    // ———————————— B) API para Track NoOficial #1 ————————————
    if (config.trackUnof1_id) {
      const arrUnof1 = await obtenerResultadosAPI(
        config.trackUnof1_id,
        config.trackUnof1_protected,
        config.trackUnof1_nombre,
        config.trackUnof1_escenario,
        3 // race_mode = 3 (1 vuelta)
      );
      arrUnof1.forEach(x => todo.push(x));
    }

    // ———————————— C) API para Track NoOficial #2 ————————————
    if (config.trackUnof2_id) {
      const arrUnof2 = await obtenerResultadosAPI(
        config.trackUnof2_id,
        config.trackUnof2_protected,
        config.trackUnof2_nombre,
        config.trackUnof2_escenario,
        3
      );
      arrUnof2.forEach(x => todo.push(x));
    }

    // 3) Devolver JSON con todos los resultados
    return res.json(todo);

  } catch (err) {
    console.error('❌ Error en /api/tiempos-mejorados:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
