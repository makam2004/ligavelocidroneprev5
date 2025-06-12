// public/main.js

document.addEventListener('DOMContentLoaded', async () => {
  const contenedor = document.getElementById('contenedorResultados');
  contenedor.innerHTML = '<p>Cargando resultados...</p>';

  try {
    const response = await fetch('/api/tiempos-hibrido');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!data || data.length === 0) {
      contenedor.innerHTML = '<p>No hay resultados disponibles en este momento.</p>';
      return;
    }

    // Vaciar el contenedor
    contenedor.innerHTML = '';

    // Para cada resultado, crear una tarjeta
    data.forEach(item => {
      const card = document.createElement('div');
      card.classList.add('card'); // Si tienes estilos en CSS

      card.innerHTML = `
        <h3>${item.escenario} – ${item.pista}</h3>
        <p>
          <strong>Jugador:</strong> ${item.jugador}<br>
          <strong>Tiempo:</strong> ${item.tiempo}<br>
          <strong>Modelo:</strong> ${item.modelo}<br>
          <strong>País:</strong> ${item.pais}
        </p>
      `;

      contenedor.appendChild(card);
    });

  } catch (err) {
    console.error('Error al cargar datos:', err);
    contenedor.innerHTML = '<p>Error al cargar los datos del servidor.</p>';
  }
});
