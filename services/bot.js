// bot.js
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN1;
const CHAT_ID  = process.env.TELEGRAM_CHAT_ID1;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error('❌ Faltan las variables de entorno TELEGRAM_BOT_TOKEN1 y/o TELEGRAM_CHAT_ID1');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
    console.error('Conflicto 409 detectado. Cerrando bot para evitar múltiples instancias.');
    process.exit(1);
  } else {
    console.error('Error de polling:', error);
  }
});

function calcularSemanaActual() {
  const fecha = new Date();
  const inicio = new Date(fecha.getFullYear(), 0, 1);
  const dias = Math.floor((fecha - inicio) / 86400000);
  return Math.ceil((dias + inicio.getDay() + 1) / 7);
}

// /top → ranking semanal completo, siempre en thread_id = 4
bot.onText(/\/top/, async (msg) => {
  const threadId = 4;
  try {
    const res = await fetch('https://ligavelocidrone.onrender.com/api/tiempos-mejorados');
    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error('Formato de datos de tiempos no válido');
    }

    const semana = calcularSemanaActual();
    let mensaje = `🏁 <b>Resultados Semanales - Semana ${semana}</b>\n`;

    data.forEach((pistaObj, idx) => {
      const encabezado = idx === 0
        ? 'Track 1 – Race Mode: Single Class'
        : 'Track 2 – 3 Lap: Single Class';
      mensaje += `\n📍 <b>${encabezado}</b>\n`;

      const ordenados = pistaObj.resultados.slice().sort((a, b) => a.tiempo - b.tiempo);

      ordenados.forEach((r, i) => {
        const posicion = i + 1;
        mensaje += `${posicion}. <b>${r.jugador}</b> — <code>${r.tiempo.toFixed(2)} s</code>\n`;
      });

      mensaje += '\n';
    });

    await bot.sendMessage(CHAT_ID, mensaje, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });
    console.log('✅ /top enviado a grupo', CHAT_ID, 'en hilo', threadId);
  } catch (error) {
    console.error('❌ Error en /top:', error);
    await bot.sendMessage(CHAT_ID, `⚠️ No se pudo obtener el ranking semanal:\n${error.message}`, {
      message_thread_id: threadId
    });
  }
});

// /supertop → clasificación anual, siempre en thread_id = 4
bot.onText(/\/supertop/, async (msg) => {
  const threadId = 4;
  try {
    const res = await fetch('https://ligavelocidrone.onrender.com/api/enviar-ranking-anual');
    const json = await res.json();

    let dataArray = null;
    if (json && json.ok && Array.isArray(json.data)) {
      dataArray = json.data;
    } else if (Array.isArray(json)) {
      dataArray = json;
    }

    if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
      await bot.sendMessage(CHAT_ID, '⚠️ La clasificación anual está vacía o no disponible.', {
        message_thread_id: threadId
      });
      return;
    }

    const encabezado = `<b>🏆 Clasificación Anual 🏆</b>\n\n`;
    const lineas = dataArray.map((jugador, i) => {
      const medalla = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎖️';
      return `${medalla} <b>${jugador.nombre}</b> — <i>${jugador.puntos_anuales} pts</i>`;
    }).join('\n');

    const mensaje = encabezado + lineas;

    await bot.sendMessage(CHAT_ID, mensaje, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });
    console.log('✅ /supertop enviado a grupo', CHAT_ID, 'en hilo', threadId);
  } catch (error) {
    console.error('❌ Error en /supertop:', error);
    await bot.sendMessage(CHAT_ID, `⚠️ No se pudo obtener la clasificación anual:\n${error.message}`, {
      message_thread_id: threadId
    });
  }
});

// /tracks → configuración de tracks semanales, siempre en thread_id = 3
bot.onText(/\/tracks/, async (msg) => {
  const threadId = 3;
  try {
    const res = await fetch('https://ligavelocidrone.onrender.com/api/configuracion');
    const json = await res.json();

    if (
      !json ||
      !json.track1_nombreEscenario ||
      !json.track1_nombrePista ||
      !json.track2_nombreEscenario ||
      !json.track2_nombrePista
    ) {
      await bot.sendMessage(CHAT_ID, '⚠️ Configuración de tracks no encontrada o incompleta.', {
        message_thread_id: threadId
      });
      return;
    }

    const texto =
      `<b>Track 1:</b>\n` +
      `Race Mode: Single Class\n` +
      `Escenario: ${json.track1_nombreEscenario}\n` +
      `Track: ${json.track1_nombrePista}\n\n` +
      `<b>Track 2:</b>\n` +
      `3 Lap: Single Class\n` +
      `Escenario: ${json.track2_nombreEscenario}\n` +
      `Track: ${json.track2_nombrePista}`;

    await bot.sendMessage(CHAT_ID, texto, {
      parse_mode: 'HTML',
      message_thread_id: threadId
    });
    console.log('✅ /tracks enviado a grupo', CHAT_ID, 'en hilo', threadId);
  } catch (error) {
    console.error('❌ Error en /tracks:', error);
    await bot.sendMessage(CHAT_ID, `⚠️ No se pudo obtener los tracks semanales:\n${error.message}`, {
      message_thread_id: threadId
    });
  }
});

// /help → listado de comandos en el mismo hilo que se ejecuta
bot.onText(/\/help/, async (msg) => {
  const threadId = msg.message_thread_id; // solo usa el hilo actual
  const texto =
    `<b>🤖 Comandos disponibles:</b>\n\n` +
    `<b>/top</b> - Envía el ranking semanal completo (todos los pilotos con sus tiempos).\n` +
    `<b>/supertop</b> - Muestra la clasificación anual actual.\n` +
    `<b>/tracks</b> - Muestra los escenarios y nombres de pista semanales.\n` +
    `<b>/help</b> - Muestra esta ayuda.\n\n` +
    `Para ejecutar un comando, escríbelo en este hilo.`;

  const options = { parse_mode: 'HTML' };
  if (threadId !== undefined) {
    options.message_thread_id = threadId;
  }
  await bot.sendMessage(CHAT_ID, texto, options);
  console.log('✅ /help enviado a grupo', CHAT_ID, 'en hilo', threadId);
});

console.log('🤖 Bot activo con TOKEN1, escuchando comandos /top, /supertop, /tracks y /help');
