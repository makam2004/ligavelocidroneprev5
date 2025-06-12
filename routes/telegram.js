import express from 'express';
import fetch from 'node-fetch';
import supabase from '../supabaseClient.js';
import puppeteer from 'puppeteer';

const router = express.Router();

function calcularSemanaActual() {
  const fecha = new Date();
  const inicio = new Date(fecha.getFullYear(), 0, 1);
  const dias = Math.floor((fecha - inicio) / 86400000);
  return Math.ceil((dias + inicio.getDay() + 1) / 7);
}

async function obtenerResultados(url, nombresJugadores, textoPestania) {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

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

router.get('/api/enviar-ranking-telegram', async (req, res) => {
  try {
    const semana = calcularSemanaActual();

    const { data: jugadores, error: errorJugadores } = await supabase
      .from('jugadores')
      .select('nombre');
    if (errorJugadores) throw errorJugadores;

    const nombresJugadores = jugadores.map(j => j.nombre);

    const { data: config, error: errorConfig } = await supabase
      .from('configuracion')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (errorConfig || !config) throw new Error('No se pudo leer configuración');

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

    let mensaje = `🏁 <b>Resultados Semanales - Semana ${semana}</b>\n`;

    for (const { url, pestaña } of urls) {
      const { pista, escenario, resultados } = await obtenerResultados(url, nombresJugadores, pestaña);

      const tipo = pestaña.includes('3 Lap')
        ? 'Single Class - Three Lap Race'
        : 'Single Class - Laps';

      mensaje += `\n📍 <b>${tipo} - ${escenario} - ${pista}</b>\n`;

      const ordenados = resultados.sort((a, b) => a.tiempo - b.tiempo);
      ordenados.forEach((r, i) => {
        const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🍬';
        mensaje += `${medalla} <b>${r.jugador}</b> — <code>${r.tiempo.toFixed(2)}s</code>\n`;
      });
    }

    mensaje += `\n📊 <b>Consulta los rankings completos en:</b>\n` +
               `➡️ <a href="https://ligavelocidrone.onrender.com/">ligavelocidrone.onrender.com</a>`;

    // Primer envío
    const response1 = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: 'HTML'
      })
    });

    const json1 = await response1.json();
    if (!json1.ok) throw new Error('Telegram error (grupo principal): ' + json1.description);

    // Segundo envío con hilo (thread)
    const response2 = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN1}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID1,
        message_thread_id: 4,
        text: mensaje,
        parse_mode: 'HTML'
      })
    });

    const json2 = await response2.json();
    if (!json2.ok) throw new Error('Telegram error (grupo 2): ' + json2.description);

    res.json({ ok: true, enviado: true });
  } catch (err) {
    console.error('Error enviando ranking a Telegram:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
