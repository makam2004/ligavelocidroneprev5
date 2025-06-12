// routes/tiempos-hibrido.js
// Versión híbrida que usa API + fallback a scraping

import express from 'express';
import puppeteer from 'puppeteer';
import supabase from '../supabaseClient.js';
import velocidroneAPI from '../services/velocidrone-api-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

function calcularSemanaActual() {
  const fecha = new Date();
  const inicio = new Date(fecha.getFullYear(), 0, 1);
  const dias = Math.floor((fecha - inicio) / 86400000);
  return Math.ceil((dias + inicio.getDay() + 1) / 7);
}

// Función de scraping original (como fallback)
async function obtenerResultadosScraping(url, nombresJugadores, textoPestania) {
  try {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('URL inválida');
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.evaluate((texto) => {
      const tab = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes(texto));
      if (tab) tab.click();
    }, textoPestania);

    await new Promise(res => setTimeout(res, 1000));
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const pista = await page.$eval('div.container h3', el => el.innerText.trim());
    const escenario = await page.$eval('h2.text-center', el => el.innerText.trim());

    const resultados = await page.$$eval('tbody tr', (filas, jugadores) => {
      return filas.map(fila => {
        const celdas = fila.querySelectorAll('td');
        const tiempo = parseFloat(celdas[1]?.innerText.replace(',', '.').trim());
        const jugador = celdas[2]?.innerText.trim();
        if (jugadores.includes(jugador)) {
          return { tiempo, jugador };
        }
        return null;
      }).filter(Boolean);
    }, nombresJugadores);

    await browser.close();
    
    logger.scrapingSuccess(url, resultados);
    return { pista, escenario, resultados };
  } catch (e) {
    logger.scrapingError(url, e);
    return { pista: 'Error', escenario: 'Error', resultados: [] };
  }
}

// Extraer track_id de la URL de Velocidrone
function extractTrackIdFromURL(url) {
  // URL format: https://www.velocidrone.com/leaderboard/{escena}/{pista}/All
  // Necesitamos mapear esto al track_id de la API
  const match = url.match(/\/leaderboard\/(\d+)\/(\d+)\/All/);
  if (match) {
    const escena = parseInt(match[1]);
    const pista = parseInt(match[2]);
    // El track_id podría ser una combinación o mapeo específico
    // Por ahora, usaremos la pista como track_id
    return pista;
  }
  return null;
}

// Obtener datos usando API + fallback a scraping
async function obtenerResultadosHibrido(config, nombresJugadores) {
  const { url, pestaña: textoPestania } = config;
  
  try {
    // Intentar primero con la API si tenemos track_id
    const trackId = extractTrackIdFromURL(url);
    
    if (trackId && process.env.VELOCIDRONE_API_TOKEN) {
      logger.info('🔄 Intentando obtener datos via API', { trackId, textoPestania });
      
      const raceMode = textoPestania.includes('3 Lap') ? 6 : 3;
      const leaderboardData = await velocidroneAPI.getLeaderboard(trackId, raceMode);
      
      // Filtrar jugadores registrados
      const resultadosFiltrados = leaderboardData.filter(record => 
        nombresJugadores.includes(record.jugador)
      );

      if (resultadosFiltrados.length > 0) {
        logger.info('✅ Datos obtenidos via API', { 
          trackId, 
          resultados: resultadosFiltrados.length 
        });
        
        return {
          pista: `Track ${trackId}`,
          escenario: 'API Data',
          resultados: resultadosFiltrados.map(r => ({
            jugador: r.jugador,
            tiempo: r.tiempo,
            modelo: r.modelo,
            pais: r.pais
          })),
          fuente: 'api'
        };
      }
    }
  } catch (apiError) {
    logger.warn('⚠️ API falló, usando scraping como fallback', { 
      error: apiError.message,
      url 
    });
  }

  // Fallback a scraping
  logger.info('🔄 Usando scraping como método principal/fallback', { url });
  const scrapingResult = await obtenerResultadosScraping(url, nombresJugadores, textoPestania);
  
  return {
    ...scrapingResult,
    fuente: 'scraping'
  };
}

// Endpoint principal híbrido
router.get('/api/tiempos-hibrido', async (_req, res) => {
  const semana = calcularSemanaActual();

  try {
    // Leer jugadores
    const { data: jugadores, error: errorJugadores } = await supabase
      .from('jugadores')
      .select('id, nombre');
    if (errorJugadores) throw new Error('Error al leer jugadores: ' + errorJugadores.message);
    
    const nombreToId = Object.fromEntries(jugadores.map(j => [j.nombre, j.id]));
    const nombresJugadores = Object.keys(nombreToId);

    // Leer configuración
    const { data: config, error: errorConfig } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (errorConfig || !config) throw new Error('No se pudo leer configuración');

    const urls = [
      {
        url: `https://www.velocidrone.com/leaderboard/${config.track1_escena}/${config.track1_pista}/All`,
        pestaña: 'Race Mode: Single Class'
      },
      {
        url: `https://www.velocidrone.com/leaderboard/${config.track2_escena}/${config.track2_pista}/All`,
        pestaña: '3 Lap: Single Class'
      }
    ];

    const respuesta = [];
    const estadisticas = {
      totalJugadores: nombresJugadores.length,
      metodoUsado: {},
      errores: []
    };

    for (const urlConfig of urls) {
      try {
        const resultado = await obtenerResultadosHibrido(urlConfig, nombresJugadores);
        
        // Estadísticas
        estadisticas.metodoUsado[urlConfig.pestaña] = resultado.fuente;

        const resultadosConId = resultado.resultados.map(r => ({
          ...r,
          jugador_id: nombreToId[r.jugador]
        }));

        const comparados = [];

        for (const r of resultadosConId) {
          if (!r.jugador_id) continue;

          const { data: hist } = await supabase
            .from('mejores_tiempos')
            .select('mejor_tiempo')
            .eq('jugador_id', r.jugador_id)
            .eq('pista', resultado.pista)
            .eq('escenario', resultado.escenario)
            .maybeSingle();

          const mejorHistorico = hist?.mejor_tiempo ?? r.tiempo;
          const mejora = parseFloat((mejorHistorico - r.tiempo).toFixed(2));

          const resultadoFinal = {
            jugador: r.jugador,
            tiempo: r.tiempo,
            mejora,
            fuente: resultado.fuente
          };

          // Añadir datos extra si vienen de la API
          if (resultado.fuente === 'api' && r.modelo) {
            resultadoFinal.modelo = r.modelo;
            resultadoFinal.pais = r.pais;
          }

          comparados.push(resultadoFinal);

          // Actualizar mejor tiempo si es necesario
          if (!hist || r.tiempo < hist.mejor_tiempo) {
            await supabase.from('mejores_tiempos').upsert({
              jugador_id: r.jugador_id,
              pista: resultado.pista,
              escenario: resultado.escenario,
              mejor_tiempo: r.tiempo,
              ultima_actualizacion: new Date().toISOString()
            }, { onConflict: ['jugador_id', 'pista', 'escenario'] });
          }

          // Guardar resultado
          await supabase.from('resultados').insert({
            jugador_id: r.jugador_id,
            semana,
            pista: resultado.pista,
            escenario: resultado.escenario,
            tiempo: r.tiempo
          });
        }

        comparados.sort((a, b) => a.tiempo - b.tiempo);
        respuesta.push({ 
          pista: resultado.pista, 
          escenario: resultado.escenario, 
          resultados: comparados,
          fuente: resultado.fuente
        });

      } catch (error) {
        logger.error('❌ Error procesando track', { 
          url: urlConfig.url, 
          error: error.message 
        });
        estadisticas.errores.push({
          track: urlConfig.pestaña,
          error: error.message
        });
      }
    }

    // Log estadísticas
    logger.info('📊 Estadísticas de obtención de datos', estadisticas);

    res.json({
      data: respuesta,
      estadisticas,
      semana
    });

  } catch (err) {
    logger.error('❌ Error general en tiempos híbridos', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para obtener estadísticas de la API
router.get('/api/velocidrone-api-stats', async (_req, res) => {
  try {
    const stats = velocidroneAPI.getStats();
    const health = await velocidroneAPI.healthCheck();
    
    res.json({
      ...stats,
      health,
      endpoints: {
        leaderboard: '/api/leaderboard',
        models: '/api/get-models',
        sceneries: '/api/get-sceneries'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener modelos y escenarios disponibles
router.get('/api/velocidrone-metadata', async (_req, res) => {
  try {
    const [models, sceneries] = await Promise.all([
      velocidroneAPI.getModels(),
      velocidroneAPI.getSceneries()
    ]);

    res.json({
      models: models.slice(0, 20), // Limitar para no sobrecargar
      sceneries: sceneries.slice(0, 20),
      total: {
        models: models.length,
        sceneries: sceneries.length
      }
    });
  } catch (error) {
    logger.error('❌ Error obteniendo metadata', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para limpiar cache de la API
router.post('/api/clear-api-cache', async (_req, res) => {
  try {
    velocidroneAPI.clearCache();
    res.json({ ok: true, message: 'Cache limpiado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;