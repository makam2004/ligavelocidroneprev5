// routes/tips.js
import express from 'express';
import supabase from '../supabaseClient.js';

const router = express.Router();

/**
 * GET /api/tips?semana=<n>
 * Devuelve todos los tips de la semana indicada.
 */
router.get('/api/tips', async (req, res) => {
  try {
    const semana = parseInt(req.query.semana, 10);
    if (isNaN(semana)) {
      return res.status(400).json({ ok: false, error: 'Semana inválida' });
    }

    const { data: tips, error } = await supabase
      .from('tips')
      .select('*')
      .eq('semana', semana);

    if (error) throw error;
    return res.json(tips);
  } catch (err) {
    console.error('❌ Error en /api/tips:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
