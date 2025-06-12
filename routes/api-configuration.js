// routes/api-configuration.js
// Gestión de configuración mejorada para API + Scraping

import express from 'express';
import supabase from '../supabaseClient.js';
import velocidroneAPI from '../services/velocidrone-api-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Obtener configuración con IDs de API cuando sea posible
router.get('/api/configuracion-avanzada', async (_req, res) => {
  try {
    // Obtener configuración actual
    const { data: config, error } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;

    // Intentar obtener metadatos de la API si está disponible
    let apiMetadata = null;
    try {
      if (process.env.VELOCIDRONE_API_TOKEN) {
        const [models, sceneries] = await Promise.all([
          velocidroneAPI.getModels(),
          velocidroneAPI.getSceneries()
        ]);
        apiMetadata = { models, sceneries };
      }
    } catch (apiError) {
      logger.warn('⚠️ No se pudo obtener metadata de API', { error: apiError.message });
    }

    // Construir configuración completa
    const configCompleta = {
      tracks: [
        {
          numero: 1,
          nombre: 'Track 1 - Race Mode',
          escena_id: config.track1_escena,
          pista_id: config.track1_pista,
          url: `https://www.velocidrone.com/leaderboard/${config.track1_escena}/${config.track1_pista}/All`,
          pestaña: 'Race Mode: Single Class',
          race_mode: 3, // 1 lap en la API
          // Si tenemos API metadata, intentar encontrar nombres
          ...(apiMetadata && {
            escenario_nombre: findScenarioName(apiMetadata.sceneries, config.track1_escena),
            track_id_api: config.track1_pista // Asumir que pista_id = track_id por ahora
          })
        },
        {
          numero: 2,
          nombre: 'Track 2 - 3 Lap',
          escena_id: config.track2_escena,
          pista_id: config.track2_pista,
          url: `https://www.velocidrone.com/leaderboard/${config.track2_escena}/${config.track2_pista}/All`,
          pestaña: '3 Lap: Single Class',
          race_mode: 6, // 3 lap en la API
          ...(apiMetadata && {
            escenario_nombre: findScenarioName(apiMetadata.sceneries, config.track2_escena),
            track_id_api: config.track2_pista
          })
        }
      ],
      api_disponible: !!process.env.VELOCIDRONE_API_TOKEN,
      metadata: apiMetadata,
      fecha_actualizacion: config.fecha_actualizacion
    };

    res.json(configCompleta);
  } catch (err) {
    logger.error('❌ Error obteniendo configuración avanzada', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// Helper para encontrar nombre de escenario
function findScenarioName(sceneries, sceneryId) {
  const scenario = sceneries.find(s => s.scenery_id === sceneryId);
  return scenario ? scenario.scenery_name : `Scenario ${sceneryId}`;
}

// Endpoint para buscar tracks en la API por nombre/escenario
router.post('/api/buscar-tracks', async (req, res) => {
  try {
    const { escenario_nombre, filtro } = req.body;
    
    if (!process.env.VELOCIDRONE_API_TOKEN) {
      return res.status(400).json({ 
        error: 'API token no configurado' 
      });
    }

    // Obtener todas las combinaciones posibles (esto requeriría múltiples calls)
    // Por ahora, devolvemos los metadatos disponibles
    const [models, sceneries] = await Promise.all([
      velocidroneAPI.getModels(),
      velocidroneAPI.getSceneries()
    ]);

    let scenariosFiltrados = sceneries;
    if (filtro) {
      scenariosFiltrados = sceneries.filter(s => 
        s.scenery_name.toLowerCase().includes(filtro.toLowerCase())
      );
    }

    res.json({
      sceneries: scenariosFiltrados.slice(0, 50), // Limitar resultados
      total: scenariosFiltrados.length,
      models: models.slice(0, 20) // Algunos modelos para referencia
    });

  } catch (error) {
    logger.error('❌ Error buscando tracks', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para actualizar configuración con soporte API
router.post('/api/actualizar-configuracion-avanzada', async (req, res) => {
  try {
    const { 
      track1_escena, 
      track1_pista, 
      track2_escena, 
      track2_pista,
      track1_api_id,
      track2_api_id 
    } = req.body;

    // Validar parámetros básicos
    if (!track1_escena || !track1_pista || !track2_escena || !track2_pista) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos' 
      });
    }

    // Construir objeto de configuración
    const nuevaConfig = {
      id: 1,
      track1_escena: parseInt(track1_escena),
      track1_pista: parseInt(track1_pista),
      track2_escena: parseInt(track2_escena),
      track2_pista: parseInt(track2_pista),
      fecha_actualizacion: new Date().toISOString()
    };

    // Si tenemos IDs de API, guardarlos también
    if (track1_api_id) nuevaConfig.track1_api_id = parseInt(track1_api_id);
    if (track2_api_id) nuevaConfig.track2_api_id = parseInt(track2_api_id);

    // Actualizar en Supabase
    const { error: updateError } = await supabase
      .from('configuracion')
      .upsert([nuevaConfig], { onConflict: ['id'] });

    if (updateError) throw updateError;

    // Limpiar cache de API para nueva configuración
    if (process.env.VELOCIDRONE_API_TOKEN) {
      velocidroneAPI.clearCache();
    }

    // Intentar incrementar ranking anual si existe
    try {
      const { error: rpcError } = await supabase.rpc('incrementar_ranking_anual');
      if (rpcError && !rpcError.message.includes('does not exist')) {
        logger.warn('⚠️ Error incrementando ranking anual', { error: rpcError.message });
      }
    } catch (rpcCatch) {
      logger.warn('⚠️ RPC incrementar_ranking_anual no disponible');
    }

    // Verificar que la configuración funciona con API si está disponible
    let verificacionAPI = null;
    if (process.env.VELOCIDRONE_API_TOKEN && track1_api_id) {
      try {
        const testData = await velocidroneAPI.getLeaderboard(track1_api_id, 3, '1.16', 10);
        verificacionAPI = {
          success: true,
          track1_resultados: testData.length,
          message: 'API funcionando correctamente'
        };
      } catch (apiError) {
        verificacionAPI = {
          success: false,
          error: apiError.message,
          message: 'API no funciona con estos IDs'
        };
      }
    }

    res.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      configuracion: nuevaConfig,
      api_verification: verificacionAPI
    });

  } catch (error) {
    logger.error('❌ Error actualizando configuración', { error: error.message });
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Endpoint para probar configuración antes de guardar
router.post('/api/probar-configuracion', async (req, res) => {
  try {
    const { track_id, race_mode = 6, sim_version = '1.16' } = req.body;

    if (!process.env.VELOCIDRONE_API_TOKEN) {
      return res.status(400).json({ 
        error: 'API token no configurado para pruebas' 
      });
    }

    if (!track_id) {
      return res.status(400).json({ error: 'track_id requerido' });
    }

    // Probar obtener datos de la API
    const testData = await velocidroneAPI.getLeaderboard(
      parseInt(track_id), 
      parseInt(race_mode), 
      sim_version, 
      10 // Solo 10 resultados para prueba
    );

    res.json({
      success: true,
      track_id: parseInt(track_id),
      race_mode: parseInt(race_mode),
      resultados_encontrados: testData.length,
      sample_data: testData.slice(0, 3), // Muestra de datos
      message: 'Configuración válida - API responde correctamente'
    });

  } catch (error) {
    logger.error('❌ Error probando configuración', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'La configuración no funciona con la API'
    });
  }
});

export default router;