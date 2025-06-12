import express from "express";
import supabase from "../supabaseClient.js";
import axios from "axios";
import { tiemposMejorados } from "./tiemposMejorados.js";

const router = express.Router();

router.get("/api/check-mejoras", async (req, res) => {
  try {
    const datos = await tiemposMejorados();
    console.log("Datos recibidos de tiemposMejorados:", datos);
    const mejorasDetectadas = [];

    for (const registro of datos) {
      const { piloto, track, tiempo } = registro;

      const { data: existente, error: errorSelect } = await supabase
        .from("ultimos_tiempos")
        .select("*")
        .eq("piloto", piloto)
        .eq("track", track)
        .maybeSingle();

      if (errorSelect) continue;

      if (!existente) {
        await supabase.from("ultimos_tiempos").insert({ piloto, track, tiempo });
        continue;
      }

      if (tiempo < existente.tiempo) {
        mejorasDetectadas.push({
          piloto,
          track,
          tiempoAnterior: existente.tiempo,
          tiempoNuevo: tiempo
        });

        await supabase
          .from("ultimos_tiempos")
          .update({ tiempo, fecha: new Date().toISOString() })
          .eq("piloto", piloto)
          .eq("track", track);
      }
    }

    for (const mejora of mejorasDetectadas) {
      const mensaje = `⏱️ *Nueva mejora de tiempo en el ${mejora.track}*\n` +
                      `👤 *Piloto*: ${mejora.piloto}\n` +
                      `🔻 *Tiempo anterior*: ${mejora.tiempoAnterior.toFixed(2)} s\n` +
                      `✅ *Nuevo tiempo*: ${mejora.tiempoNuevo.toFixed(2)} s\n` +
                      `📅 ${new Date().toLocaleString("es-ES")}`;

      try {
        console.log("Enviando mensaje al grupo 2 de Telegram:", mensaje);
        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN1}/sendMessage`, {
          chat_id: process.env.TELEGRAM_CHAT_ID1,
          text: mensaje,
          parse_mode: "Markdown",
          message_thread_id: 4
        });
      } catch (e) {
        console.error("❌ Error enviando a grupo 2:", e.response?.data || e.message);
      }
    }

    res.json({
      status: "ok",
      mejoras: mejorasDetectadas.length,
      detalles: mejorasDetectadas
    });
  } catch (err) {
    console.error("Error en check-mejoras:", err);
    res.status(500).json({ error: "Error en la verificación de mejoras" });
  }
});

export default router;
