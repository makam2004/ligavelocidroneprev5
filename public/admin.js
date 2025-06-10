// public/admin.js

// 1) Referencias al DOM
const formTracks    = document.getElementById('formTracks');
const mensajeTracks = document.getElementById('mensaje');
const mensajeCommit = document.getElementById('mensajeCommit');
const canvasTop3    = document.getElementById('canvasTop3');
const ctxTop3       = canvasTop3.getContext('2d');

// 2) Función auxiliar para calcular la semana actual
function calcularSemanaActual() {
  const fecha = new Date();
  const inicio = new Date(fecha.getFullYear(), 0, 1);
  const dias = Math.floor((fecha - inicio) / 86400000);
  return Math.ceil((dias + inicio.getDay() + 1) / 7);
}

// 3) Obtener Top 3 de cada pista (Track 1 y Track 2) desde /api/tiempos-mejorados
async function obtenerTop3Pilotos() {
  const res = await fetch('/api/tiempos-mejorados');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data)) throw new Error('Datos inválidos de tiempos');

  const top3Track1 = [];
  const top3Track2 = [];

  // Aquí usamos la estructura de los datos que nos llega
  if (data.length > 0) {
    // Ordenamos los datos por mejor_tiempo y los primeros 3 se convierten en el Top 3
    data.slice(0, 3).forEach((r) => {
      const nombreJugador = r.jugador_id;  // O donde tienes el nombre real
      const tiempo = r.mejor_tiempo;
      top3Track1.push(`${nombreJugador}: ${tiempo} s`);
    });
  } else {
    console.warn("No se encontraron resultados para Track 1");
  }

  return { top3Track1, top3Track2 };
}

// 4) Función auxiliar para extraer ID de YouTube
function obtenerYouTubeID(url) {
  const regex = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// 5) Al cambiar el campo URL, actualizamos el iframe
tipUrlInput.addEventListener('input', () => {
  const url = tipUrlInput.value.trim();
  const videoID = obtenerYouTubeID(url);

  if (videoID) {
    // Construir la URL de embed
    tipIframe.src = `https://www.youtube.com/embed/${videoID}`;
    tipIframe.style.display = 'block';
  } else {
    tipIframe.src = '';
    tipIframe.style.display = 'none';
  }
});

// 6) Manejar envío del formulario de “Agregar Tip”
formAgregarTip.onsubmit = async (e) => {
  e.preventDefault();
  mensajeAgregarTip.style.color = 'white';
  mensajeAgregarTip.textContent = '🔄 Subiendo tip…';

  try {
    await ensureSupabase();

    // 6.1) Leer campos
    const titulo = tipTitleInput.value.trim();
    const url    = tipUrlInput.value.trim();
    const tipo   = tipTypeInput.value.trim() || 'youtube';
    if (!titulo || !url) throw new Error('Título y URL son obligatorios.');

    // 6.2) Generar ID aleatorio
    let id;
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = String(Date.now()) + Math.floor(Math.random() * 1000);
    }
    // 6.3) Fecha actual en ISO
    const fecha = new Date().toISOString();

    // 6.4) Insertar en Supabase
    const { data, error } = await supabaseClient
      .from('tips')
      .insert([{ id, titulo, url, tipo, fecha }]);

    if (error) throw error;

    // 6.5) Enviar notificación a Telegram
    mensajeAgregarTip.textContent = '🔄 Enviando notificación a Telegram…';
    const respTelegram = await fetch('/api/send-tip-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, url, tipo, fecha })
    });
    const jsonTelegram = await respTelegram.json();
    if (!jsonTelegram.ok) throw new Error(jsonTelegram.error || 'Error al enviar a Telegram');

    // 6.6) Mostrar éxito y cerrar popup
    mensajeAgregarTip.style.color = 'lightgreen';
    mensajeAgregarTip.textContent = '✅ Tip agregado y notificado a Telegram.';

    if (window.cargarTipsPopup) {
      await window.cargarTipsPopup();
    }
    setTimeout(() => {
      popupAgregarTip.style.display = 'none';
      overlayAgregarTip.style.display = 'none';
    }, 1000);

  } catch (err) {
    console.error('Error agregando tip:', err);
    mensajeAgregarTip.style.color = 'red';
    mensajeAgregarTip.textContent = `❌ ${err.message}`;
  }
};
