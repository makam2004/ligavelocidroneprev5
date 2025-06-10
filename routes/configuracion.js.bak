// routes/configuracion.js

import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

router.get('/api/obtener-config', async (req, res) => {
  try {
    // 1) Leer la fila id=1 de 'configuracion', incluidos los campos nuevos:
    const { data: config, error } = await supabase
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

    if (error) throw error;
    if (!config) return res.status(404).json({ error: 'Sin configuración' });

    // 2) Llamar a tu función de scraping para obtener nombres de escenarios/pistas de los tracks oficiales.
    //    Supongamos que existe la función:
    //      async function scrapeNombreEscenarioYPista(escenaId, pistaId) { ... }
    //    y devuelve { nombreEscenario, nombrePista }.
    //    Ajusta estos nombres a la función exacta que ya tenías.
  track1_escena: config.track1_escena,
  track1_pista:  config.track1_pista,

    // 3) Devolver en JSON todos los campos: 
    return res.json({
      // Tracks oficiales
      track1_escena: config.track1_escena,
      track1_pista:  config.track1_pista,
      track1_nombreEscenario: track1.nombreEscenario,
      track1_nombrePista:     track1.nombrePista,

      track2_escena: config.track2_escena,
      track2_pista:  config.track2_pista,
      track2_nombreEscenario: track2.nombreEscenario,
      track2_nombrePista:     track2.nombrePista,

      // Track NoOficial #1
      trackUnof1_id:        config.trackUnof1_id,
      trackUnof1_protected: config.trackUnof1_protected,
      trackUnof1_nombre:    config.trackUnof1_nombre,
      trackUnof1_escenario: config.trackUnof1_escenario,

      // Track NoOficial #2
      trackUnof2_id:        config.trackUnof2_id,
      trackUnof2_protected: config.trackUnof2_protected,
      trackUnof2_nombre:    config.trackUnof2_nombre,
      trackUnof2_escenario: config.trackUnof2_escenario
    });
  } catch (err) {
    console.error('Error al obtener configuración:', err);
    return res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

export default router;
