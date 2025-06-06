// routes/admin.js

import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

router.post('/admin/update-tracks', async (req, res) => {
  try {
    const {
      track1_escena,
      track1_pista,
      track2_escena,
      track2_pista,

      // Nuevos campos – Track NoOficial #1
      trackUnof1_id,
      trackUnof1_protected,
      trackUnof1_nombre,
      trackUnof1_escenario,

      // Nuevos campos – Track NoOficial #2
      trackUnof2_id,
      trackUnof2_protected,
      trackUnof2_nombre,
      trackUnof2_escenario
    } = req.body;

    // Convertir "protected" de string a booleano
    const _trackUnof1_protected = (trackUnof1_protected === 'true');
    const _trackUnof2_protected = (trackUnof2_protected === 'true');

    // Upsert en tabla configuracion
    const { error: errUpsert } = await supabase
      .from('configuracion')
      .upsert([{
        id: 1,

        // Tracks oficiales
        track1_escena,
        track1_pista,
        track2_escena,
        track2_pista,

        // Track NoOficial #1
        trackUnof1_id:        trackUnof1_id        || null,
        trackUnof1_protected: _trackUnof1_protected,
        trackUnof1_nombre:    trackUnof1_nombre    || null,
        trackUnof1_escenario: trackUnof1_escenario || null,

        // Track NoOficial #2
        trackUnof2_id:        trackUnof2_id        || null,
        trackUnof2_protected: _trackUnof2_protected,
        trackUnof2_nombre:    trackUnof2_nombre    || null,
        trackUnof2_escenario: trackUnof2_escenario || null,

        fecha_actualizacion: new Date().toISOString()
      }], { onConflict: ['id'] });

    if (errUpsert) throw errUpsert;
    return res.json({ ok: true });
  } catch (err) {
    console.error('❌ Error en /admin/update-tracks:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
