// public/tips_popup.js

document.addEventListener('DOMContentLoaded', async () => {
  // Calcula la semana actual (por ejemplo, usando la fecha del navegador)
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const numeroSemana = Math.ceil(
    (((now - oneJan) / 86400000) + oneJan.getDay() + 1) / 7
  );

  // Llamada a tu propio endpoint para obtener tips
  // (Si prefieres llamar directo desde el front a Supabase,
  //  deberás exponer las credenciales o usar RLS/anon key).
  try {
    const response = await fetch(`/api/tips?semana=${numeroSemana}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const tips = await response.json();
    if (tips.length > 0) {
      // Mostrar el primer tip (o iterar si hay varios)
      const tip = tips[0];
      mostrarPopupTip(tip);
    }
  } catch (err) {
    console.warn('No se pudo cargar tip de la semana:', err);
  }
});

function mostrarPopupTip(tip) {
  // Ejemplo simple: crear un alert o un div emergente
  alert(`Tip para la semana ${tip.semana}:\n\n${tip.titulo}\n\n${tip.descripcion}`);
}
