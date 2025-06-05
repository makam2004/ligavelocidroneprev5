// routes/commitRanking.js
import express from 'express';
import supabase from '../supabaseClient.js';
import { sendTelegramMessage } from '../utils/telegramHelper.js';

const router = express.Router();

/**
 * GET /api/commit-ranking
 *
 * Suma todos los puntos_semanales a puntos_anuales para cada jugador,
 * resetea puntos_semanales a 0 y envía un mensaje a Telegram con el ranking.
 */
router.get('/api/commit-ranking', async (req, res) => {
  try {
    // 1) Obtener todos los jugadores
    const { data: jugadores, error: errPlay } = await supabase
      .from('jugadores')
      .select('*');
    if (errPlay) throw errPlay;

    // 2) Para cada jugador, sumar y resetear semanales
    for (let jugador of jugadores) {
      const nuevosPuntos = jugador.puntos_anuales + jugador.puntos_semanales;
      const { error: errUpd } = await supabase
        .from('jugadores')
        .update({
          puntos_anuales: nuevosPuntos,
          puntos_semanales: 0
        })
        .eq('id', jugador.id);
      if (errUpd) console.error(`Error al actualizar jugador ${jugador.id}:`, errUpd);
    }

    // 3) Obtener ranking anual ordenado
    const { data: rankingAnual, error: errRank } = await supabase
      .from('jugadores')
      .select('*')
      .order('puntos_anuales', { ascending: false });
    if (errRank) throw errRank;

    // 4) Construir mensaje de Telegram
    let mensaje = '🏆 *Ranking Anual Velocidrone* 🏆\n\n';
    rankingAnual.forEach((j, idx) => {
      mensaje += `${idx + 1}. *${j.nombre}* — ${j.puntos_anuales} pts\n`;
    });

    // 5) Enviar mensaje a Telegram
    await sendTelegramMessage(mensaje);

    return res.json({ ok: true, ranking: rankingAnual });
  } catch (err) {
    console.error('❌ Error en /api/commit-ranking:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
