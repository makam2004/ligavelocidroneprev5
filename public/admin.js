// public/admin.js

document.addEventListener('DOMContentLoaded', () => {
  const formTracks = document.getElementById('formTracks');
  const mensajeDiv = document.getElementById('mensajeActualizarTracks');

  // Cargar datos iniciales en el formulario (opcional)
  cargarConfiguracionInicial();

  formTracks.onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(formTracks);
    // Tracks oficiales
    const track1_escena = formData.get('track1_escena');
    const track1_pista  = formData.get('track1_pista');
    const track2_escena = formData.get('track2_escena');
    const track2_pista  = formData.get('track2_pista');

    // Track NoOficial #1
    const trackUnof1_id        = formData.get('trackUnof1_id');
    const trackUnof1_protected = formData.get('trackUnof1_protected');
    const trackUnof1_nombre    = formData.get('trackUnof1_nombre');
    const trackUnof1_escenario = formData.get('trackUnof1_escenario');

    // Track NoOficial #2
    const trackUnof2_id        = formData.get('trackUnof2_id');
    const trackUnof2_protected = formData.get('trackUnof2_protected');
    const trackUnof2_nombre    = formData.get('trackUnof2_nombre');
    const trackUnof2_escenario = formData.get('trackUnof2_escenario');

    try {
      const res = await fetch('/admin/update-tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track1_escena,
          track1_pista,
          track2_escena,
          track2_pista,

          trackUnof1_id,
          trackUnof1_protected,
          trackUnof1_nombre,
          trackUnof1_escenario,

          trackUnof2_id,
          trackUnof2_protected,
          trackUnof2_nombre,
          trackUnof2_escenario
        })
      });
      const json = await res.json();
      if (json.ok) {
        mensajeDiv.innerHTML = '<span style="color:green">✓ Configuración actualizada correctamente.</span>';
      } else {
        mensajeDiv.innerHTML = `<span style="color:red">✗ Error: ${json.error}</span>`;
      }
    } catch (err) {
      console.error('Error al actualizar tracks:', err);
      mensajeDiv.innerHTML = `<span style="color:red">✗ Error al conectar con el servidor.</span>`;
    }
  };

  // Función opcional para precargar datos desde Supabase (si quieres)
  async function cargarConfiguracionInicial() {
    try {
      const res = await fetch('/api/obtener-config'); // Punto de acceso que devuelva fila config
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const config = await res.json();
      if (!config) return;

      // Rellenar campos "oficiales"
      document.querySelector('input[name="track1_escena"]').value = config.track1_escena || '';
      document.querySelector('input[name="track1_pista"]').value  = config.track1_pista  || '';
      document.querySelector('input[name="track2_escena"]').value = config.track2_escena || '';
      document.querySelector('input[name="track2_pista"]').value  = config.track2_pista  || '';

      // Rellenar campos “NoOficial1” 
      if (config.trackUnof1_id !== null) {
        document.querySelector('input[name="trackUnof1_id"]').value        = config.trackUnof1_id;
        document.querySelector('select[name="trackUnof1_protected"]').value = config.trackUnof1_protected ? 'true' : 'false';
        document.querySelector('input[name="trackUnof1_nombre"]').value     = config.trackUnof1_nombre;
        document.querySelector('input[name="trackUnof1_escenario"]').value = config.trackUnof1_escenario;
      }

      // Rellenar campos “NoOficial2”
      if (config.trackUnof2_id !== null) {
        document.querySelector('input[name="trackUnof2_id"]').value        = config.trackUnof2_id;
        document.querySelector('select[name="trackUnof2_protected"]').value = config.trackUnof2_protected ? 'true' : 'false';
        document.querySelector('input[name="trackUnof2_nombre"]').value     = config.trackUnof2_nombre;
        document.querySelector('input[name="trackUnof2_escenario"]').value = config.trackUnof2_escenario;
      }

    } catch (err) {
      console.warn('No se pudo cargar configuración inicial:', err);
    }
  }
});
