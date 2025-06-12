import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Conexión a Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Endpoint para hacer commit del ranking semanal al anual
router.post('/api/commit-ranking', async (req, res) => {
  try {
    const { data: jugadores, error } = await supabase
      .from('jugadores')
      .select('id, puntos_semanales, puntos_anuales');

    if (error) throw error;

    for (const jugador of jugadores) {
      const puntosSemana = jugador.puntos_semanales || 0;
      const puntosAnuales = jugador.puntos_anuales || 0;

      const nuevosPuntos = puntosAnuales + puntosSemana;

      const { error: updateError } = await supabase
        .from('jugadores')
        .update({
          puntos_anuales: nuevosPuntos,
          puntos_semanales: 0
        })
        .eq('id', jugador.id);

      if (updateError) throw updateError;
    }

    res.json({ success: true, message: 'Commit realizado correctamente.' });

  } catch (err) {
    console.error('Error en /api/commit-ranking:', err.message);
    res.status(500).json({ success: false, message: 'Error al hacer commit.' });
  }
});

export default router;