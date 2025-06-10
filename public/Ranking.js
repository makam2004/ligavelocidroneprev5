async function cargarRankingAnual() {
  try {
    const response = await fetch('/api/enviar-ranking-anual');
    if (!response.ok) throw new Error('Ranking anual inválido');

    const data = await response.json();

    if (!Array.isArray(data)) throw new Error('Ranking anual inválido');

    const tabla = document.getElementById('ranking-anual-body');
    if (!tabla) return;

    tabla.innerHTML = '';

    if (data.length === 0) {
      tabla.innerHTML = "<tr><td colspan='2'>No hay datos disponibles.</td></tr>";
      return;
    }

    data.forEach(jugador => {
      const fila = document.createElement('tr');
      fila.innerHTML = `<td>${jugador.nombre}</td><td>${jugador.puntos_anuales}</td>`;
      tabla.appendChild(fila);
    });

  } catch (error) {
    console.error('Error al cargar ranking anual:', error);
  }
}

window.onload = cargarRankingAnual;
