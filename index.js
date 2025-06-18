const axios = require("axios");
const bodyParser = require("body-parser");
const express = require("express");
const app = express();
const { google } = require("googleapis");

app.set("port", process.env.PORT || 3000);
app.listen(app.get("port"));
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "token";

// GET para verificación
app.get("/webhook", (req, res) => {
  console.log("🔍 [GET] Verificación de Webhook", req.query);
  if (
    req.query["hub.mode"] == "subscribe" &&
    req.query["hub.verify_token"] == VERIFY_TOKEN
  ) {
    res.send(req.query["hub.challenge"]);
    console.log("🟦 [GET] Verificación:", req.query);
  } else {
    res.sendStatus(400);
  }
});

// POST para recibir leads
app.post("/webhook", async (req, res) => {
  console.log("🔍 [POST] Recibiendo Webhook", req.body);

  try {
    const body = req.body;
    console.log("📦 Payload:", JSON.stringify(body, null, 2));

    if (body.entry) {
      const leadgenId = body.entry?.[0]?.changes?.[0]?.value?.leadgen_id;
      if (leadgenId) {
        console.log("🟢 leadgen_id recibido:", leadgenId);
      } else {
        console.warn("⚠️ No se encontró leadgen_id en el body");
      }
    }

    const lead = req.body.entry?.[0]?.changes?.[0]?.value;
    console.log("📋 Lead recibido:", lead);

    const url = `https://graph.facebook.com/v23.0/${lead.form_id}/leads?access_token=${process.env.META_ACCESS_TOKEN}`;
    console.log("🔗 URL para obtener datos del lead:", url);

    const response = await axios.get(url);
    console.log("📥 Respuesta de Meta:", response.data);
    const fieldData = response.data?.field_data;
    console.log("📋 Datos obtenidos desde Meta:", fieldData);
    let nombre = "", correo = "";
    fieldData.forEach((field) => {
      if (field.name === "nombre_completo") {
        nombre = field.values?.[0] || "";
      }
      if (field.name === "correo_electrónico") {
        correo = field.values?.[0] || "";
      }
    });
    if (lead) {
      await agregarALaHoja([nombre, correo]).catch((err) => console.error("Error:", err));
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("🛑 Error al procesar el webhook:", err);
    res.sendStatus(500);
  }
});
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
async function agregarALaHoja(values) {
  try {
    console.log("📝 Agregando a la hoja:", values);
    const client = await auth.getClient(); // ← ESTA LÍNEA es crucial
    console.log("🧪 Token info:", await client.getAccessToken());

    google.options({
      auth: client,
    });
    console.log("✅ Autenticación exitosa");
    const sheets = google.sheets({ version: "v4" });
    console.log("📊 Conectando a Google Sheets");
    const spreadsheetId = "1UNpSARGyZ_tvk-XgKANk1b_U9fODk2xH_aqUJCdyRBQ"; // copia desde la URL de tu Google Sheet
    console.log("📑 ID de la hoja de cálculo:", spreadsheetId);
    const range = "Hoja1!A2"; // cambia "Hoja1" si tu sheet tiene otro nombre

    console.log("📍 Rango de la hoja:", range);
    const resource = {
      values: [values], // debe ser un array de arrays
    };
    console.log("📥 Datos a insertar:", resource);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      resource,
    });

    console.log("Dato insertado correctamente");
  } catch (error) {
    console.error("❌ Error al autenticar con Google:", error.message);
    process.exit(1);
  }
}
