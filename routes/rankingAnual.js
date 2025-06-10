// routes/rankingAnual.js
import express from 'express';
import supabase from '../supabaseClient.js'; 

const router = express.Router();

// Endpoint para obtener el ranking anual
router.get('/ranking-anual', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('jugadores')  // Asegúrate de que la tabla 'jugadores' tiene la columna 'puntos_anuales'
      .select('nombre, puntos_anuales')
      .order('puntos_anuales', { ascending: false });  // Ordena de mayor a menor puntos

    if (error) throw error;

    res.json(data);  // Devolver los jugadores y sus puntos anuales
  } catch (err) {
    console.error('Error obteniendo ranking anual:', err);
    res.status(500).json({ error: 'Error al obtener ranking anual' });
  }
});

export default router;
