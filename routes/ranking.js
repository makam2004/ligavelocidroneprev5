// routes/ranking.js
import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

/**
 * GET /api/enviar-ranking-anual
 * 
 * Devuelve:
 *   { ok: true, data: [ { nombre, puntos_anuales }, … ] }
 * o bien:
 *   { ok: false, error: "<mensaje real de fallo>" } con status 500
 */
router.get('/api/enviar-ranking-anual', async (req, res) => {
  try {
    // 1) Hacemos la consulta a Supabase
    const { data, error } = await supabase
      .from('jugadores')
      .select('nombre, puntos_anuales')
      .order('puntos_anuales', { ascending: false });

    // 2) Si Supabase devolvió un error, lo registramos y devolvemos status 500 con el mensaje real
    if (error) {
      console.error('Error al consultar tabla "jugadores" →', error.message);
      return res
        .status(500)
        .json({ ok: false, error: error.message });
    }

    // 3) Comprobamos que data no sea null (por si ocurriera algún caso extraordinario)
    if (!data) {
      console.error('Error inesperado: "data" es null al consultar jugadores');
      return res
        .status(500)
        .json({ ok: false, error: 'No se obtuvieron datos de jugadores' });
    }

    // 4) Ahora que sabemos que data es un array (incluso vacío), hacemos .map con seguridad
    const resultado = data.map(row => ({
      nombre: row.nombre,
      puntos_anuales: row.puntos_anuales
    }));

    // 5) Devolvemos el JSON que el front-end espera
    return res.json({ ok: true, data: resultado });
  } catch (err) {
    // 6) Si salta cualquier excepción “inusual” (p. ej. supabaseClient mal inicializado),
    //    la capturamos, la registramos y le devolvemos la descripción exacta al front.
    console.error('Error inesperado en /api/enviar-ranking-anual →', err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || 'Error interno al cargar ranking anual' });
  }
});

export default router;
