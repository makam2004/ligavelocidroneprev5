// routes/tiemposMejorados.js

import express from 'express';
import puppeteer from 'puppeteer';
import supabase from '../supabaseClient.js';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * Calcula el número de semana actual (1–53) a partir de la fecha.
 */
function calcularSemanaActual() {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  return Math.ceil((((now - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
}

/**
 * Scrapea un track oficial dado su escenarioId y pistaId.
 * Debe devolver { nombreEscenario, nombrePista, resultados: Array<{ jugador, tiempo, ... }> }.
 * Se asume que esta función ya existía en tu proyecto y no debe cambiarse.
 */
async function obtenerResultados(url, nombresJugadores, textoPestania) {
  // Tu lógica de Puppeteer para abrir navegador, navegar a `url`,
  // seleccionar la pestaña `textoPestania`, leer la tabla de resultados,
  // convertir cada fila en { jugador, tiempo, modelo, country, etc. }.
  // Devuelve un objeto: { resultados: [ { jugador: 'Player1', tiempo: 83.456, ... }, ... ] }
  // No modifiques esta función.
  // …
}

/**
 * Llama a la API de Velocidrone para obtener los tres mejores tiempos de un track no oficial.
 * Devuelve un array de objetos { jugador, tiempo, modelo, pais }.
 */
async function obtenerResultadosAPI(trackId, protectedTrackValue, nombreTrack, escenario, raceMode = 3) {
  const simVersion = '1.16';
  const urlApi = 'https://velocidrone.co.uk/api/leaderboard';
  const postData =
    `track_id=${trackId}` +
    `&sim_version=${simVersion}` +
    `&offset=0` +
    `&count=3` +
    `&race_mode=${raceMode}` +
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

  return data.tracktimes.map(r => ({
    jugador: r.playername,
    tiempo:  r.lap_time,      // cadena "00:01:23.456"
    modelo:  r.model_name,
    pais:    r.country
  }));
}

router.get('/api/tiempos-mejorados', async (_req, res) => {
  try {
    const semana = calcularSemanaActual();

    // 1) Obtener todos los jugadores para construir nombre→id
    const { data: jugadores, error: errorJugadores } = await supabase
      .from('jugadores')
      .select('id, nombre');
    if (errorJugadores) throw errorJugadores;
    const nombreToId = Object.fromEntries(jugadores.map(j => [j.nombre, j.id]));

    // 2) Leer configuración completa
    const { data: config, error: errorConfig } = await supabase
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
      .maybeSingle();
    if (errorConfig || !config) throw errorConfig || new Error('Sin configuración');

    // 3) Preparar URLs y nombres para los tracks oficiales
    const urlsOficiales = [
      {
        url: `https://www.velocidrone.com/leaderboard/${config.track1_escena}/${config.track1_pista}/All`,
        pestaña: 'Race Mode: Single Class',
        nombre: `Oficial ${config.track1_escena}-${config.track1_pista}`
      },
      {
        url: `https://www.velocidrone.com/leaderboard/${config.track2_escena}/${config.track2_pista}/All`,
        pestaña: '3 Lap: Single Class',
        nombre: `Oficial ${config.track2_escena}-${config.track2_pista}`
      }
    ];

    // 4) Array donde acumularemos todos los resultados
    const todo = [];

    // 4A) SCRAPING para tracks oficiales
    for (const { url, pestaña, nombre } of urlsOficiales) {
      const { resultados } = await obtenerResultados(url, Object.keys(nombreToId), pestaña);
      resultados.forEach(r => {
        todo.push({
          piloto: r.jugador,
          track:  nombre,
          tiempo: r.tiempo
        });
      });
    }

    // 4B) Si existe TrackNoOficial #1 en configuración, llamar a la API
    if (config.trackUnof1_id) {
      const resultadosApi1 = await obtenerResultadosAPI(
        config.trackUnof1_id,
        config.trackUnof1_protected,
        config.trackUnof1_nombre || `NoOficial ${config.trackUnof1_id}`,
        config.trackUnof1_escenario || '',
        3
      );
      resultadosApi1.forEach(r => {
        todo.push({
          piloto: r.jugador,
          track:  config.trackUnof1_nombre || `NoOficial ${config.trackUnof1_id}`,
          tiempo: r.tiempo
        });
      });
    }

    // 4C) Si existe TrackNoOficial #2 en configuración, llamar a la API
    if (config.trackUnof2_id) {
      const resultadosApi2 = await obtenerResultadosAPI(
        config.trackUnof2_id,
        config.trackUnof2_protected,
        config.trackUnof2_nombre || `NoOficial ${config.trackUnof2_id}`,
        config.trackUnof2_escenario || '',
        3
      );
      resultadosApi2.forEach(r => {
        todo.push({
          piloto: r.jugador,
          track:  config.trackUnof2_nombre || `NoOficial ${config.trackUnof2_id}`,
          tiempo: r.tiempo
        });
      });
    }

    // 5) Devolver todos los resultados
    return res.json(todo);
  } catch (err) {
    console.error('❌ Error en /api/tiempos-mejorados:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
