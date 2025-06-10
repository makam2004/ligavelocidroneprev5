// routes/tiemposMejorados.js
import express from 'express';
import supabase from '../supabaseClient'; // Si usas Supabase

const router = express.Router();

// Endpoint que devuelve los tiempos mejorados (Top 3)
router.get('/tiempos-mejorados', async (req, res) => {
  try {
    // Queremos los mejores 3 tiempos para el track (pista) y escenario determinado
    const { data, error } = await supabase
      .from('resultados')  // Tu tabla de resultados
      .select('jugador_id, pista, escenario, semana, mejor_tiempo')
      .order('mejor_tiempo', { ascending: true })  // Ordenar por mejor tiempo (de menor a mayor)
      .limit(3);  // Solo los 3 primeros

    if (error) throw error;

    // Si encontramos datos, los retornamos como resultado
    res.json(data);  
  } catch (err) {
    console.error('Error obteniendo tiempos mejorados:', err);
    res.status(500).json({ error: 'Error al obtener tiempos mejorados' });
  }
});

export default router;
