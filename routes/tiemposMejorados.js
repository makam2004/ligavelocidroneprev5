import express from 'express';
import puppeteer from 'puppeteer';
import supabase from '../supabaseClient.js'; // ✅ RUTA CORRECTA

const router = express.Router();

function calcularSemanaActual() {
  const fecha = new Date();
  const inicio = new Date(fecha.getFullYear(), 0, 1);
  const dias = Math.floor((fecha - inicio) / 86400000);
  return Math.ceil((dias + inicio.getDay() + 1) / 7);
}

async function obtenerResultados(url, nombresJugadores, textoPestania) {
  try {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('URL inválida');
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Clic en pestaña específica
    await page.evaluate((texto) => {
      const tab = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes(texto));
      if (tab) tab.click();
    }, textoPestania);

    await new Promise(res => setTimeout(res, 1000));
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const pista = await page.$eval('div.container h3', el => el.innerText.trim());
    const escenario = await page.$eval('h2.text-center', el => el.innerText.trim());

    const resultados = await page.$$eval('tbody tr', (filas, jugadores) => {
      return filas.map(fila => {
        const celdas = fila.querySelectorAll('td');
        const tiempo = parseFloat(celdas[1]?.innerText.replace(',', '.').trim());
        const jugador = celdas[2]?.innerText.trim();
        if (jugadores.includes(jugador)) {
          return { tiempo, jugador };
        }
        return null;
      }).filter(Boolean);
    }, nombresJugadores);

    await browser.close();
    return { pista, escenario, resultados };
  } catch (e) {
    console.error('❌ Scraping error:', e);
    return { pista: 'Error', escenario: 'Error', resultados: [] };
  }
}

router.get('/api/tiempos-mejorados', async (_req, res) => {
  const semana = calcularSemanaActual();

  // Leer jugadores
  const { data: jugadores, error: errorJugadores } = await supabase.from('jugadores').select('id, nombre');
  if (errorJugadores) return res.status(500).json({ error: 'Error al leer jugadores' });
  const nombreToId = Object.fromEntries(jugadores.map(j => [j.nombre, j.id]));

  // Leer configuración
  const { data: config, error: errorConfig } = await supabase.from('configuracion').select('*').eq('id', 1).maybeSingle();
  if (errorConfig || !config) return res.status(500).json({ error: 'No se pudo leer configuración' });

  const urls = [
    {
      url: `https://www.velocidrone.com/leaderboard/${config.track1_escena}/${config.track1_pista}/All`,
      pestaña: 'Race Mode: Single Class'
    },
    {
      url: `https://www.velocidrone.com/leaderboard/${config.track2_escena}/${config.track2_pista}/All`,
      pestaña: '3 Lap: Single Class'
    }
  ];

  const respuesta = [];

  for (const { url, pestaña } of urls) {
    const { pista, escenario, resultados } = await obtenerResultados(url, Object.keys(nombreToId), pestaña);

    const resultadosConId = resultados.map(r => ({
      ...r,
      jugador_id: nombreToId[r.jugador]
    }));

    const comparados = [];

    for (const r of resultadosConId) {
      const { data: hist } = await supabase
        .from('mejores_tiempos')
        .select('mejor_tiempo')
        .eq('jugador_id', r.jugador_id)
        .eq('pista', pista)
        .eq('escenario', escenario)
        .maybeSingle();

      const mejorHistorico = hist?.mejor_tiempo ?? r.tiempo;
      const mejora = parseFloat((mejorHistorico - r.tiempo).toFixed(2));

      comparados.push({
        jugador: r.jugador,
        tiempo: r.tiempo,
        mejora
      });

      if (!hist || r.tiempo < hist.mejor_tiempo) {
        await supabase.from('mejores_tiempos').upsert({
          jugador_id: r.jugador_id,
          pista,
          escenario,
          mejor_tiempo: r.tiempo,
          ultima_actualizacion: new Date().toISOString()
        }, { onConflict: ['jugador_id', 'pista', 'escenario'] });
      }

      await supabase.from('resultados').insert({
        jugador_id: r.jugador_id,
        semana,
        pista,
        escenario,
        tiempo: r.tiempo
      });
    }

    comparados.sort((a, b) => a.tiempo - b.tiempo);
    respuesta.push({ pista, escenario, resultados: comparados });
  }

  res.json(respuesta);
});

export default router;

export async function tiemposMejorados() {
  const semana = calcularSemanaActual();

  const { data: jugadores, error: errorJugadores } = await supabase.from('jugadores').select('id, nombre');
  if (errorJugadores) return [];

  const nombreToId = Object.fromEntries(jugadores.map(j => [j.nombre, j.id]));

  const { data: config, error: errorConfig } = await supabase.from('configuracion').select('*').eq('id', 1).maybeSingle();
  if (errorConfig || !config) return [];

  const urls = [
    {
      url: `https://www.velocidrone.com/leaderboard/${config.track1_escena}/${config.track1_pista}/All`,
      pestaña: 'Race Mode: Single Class',
      nombre: 'Track 1'
    },
    {
      url: `https://www.velocidrone.com/leaderboard/${config.track2_escena}/${config.track2_pista}/All`,
      pestaña: '3 Lap: Single Class',
      nombre: 'Track 2'
    }
  ];

  const todo = [];

  for (const { url, pestaña, nombre } of urls) {
    const { resultados } = await obtenerResultados(url, Object.keys(nombreToId), pestaña);
    resultados.forEach(r => {
      todo.push({
        piloto: r.jugador,
        track: nombre,
        tiempo: r.tiempo
      });
    });
  }

  return todo;
}