const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { google } = require('googleapis');
const { Resend } = require('resend');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 📌 Google Sheets Auth (via variable d'environnement)
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(
    Buffer.from(process.env.GOOGLE_CREDENTIALS, 'base64').toString('utf-8')
  ),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SHEET_ID = '1S6d6SAIxUDRATlG17KcOV0CJ3ngl_yO81Qi0TlNdvXA';
const SHEET_NAME = 'Feuille 1';

// ✉️ Resend config
const resend = new Resend('re_VGJyiVrT_8F11ACxpxPwaU3WDVjxoBDb3');

// 🔧 MCP Tools
app.get('/tools', (req, res) => {
  res.json([
    {
      name: 'mcp_tool',
      description: "Dit bonjour à l'utilisateur",
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: "Le nom de l'utilisateur" },
        },
        required: ['nom'],
      },
    },
    {
      name: 'prise_rdv_tool',
      description: 'Prend un rendez-vous et le stocke dans Google Sheets + envoie un e-mail',
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: 'Nom du client' },
          date: { type: 'string', description: 'Date du rendez-vous (JJ/MM/AAAA)' },
          heure: { type: 'string', description: "Heure du rendez-vous (ex: 15:00)" },
          duree: { type: 'string', description: 'Durée du rendez-vous en minutes' },
          email: { type: 'string', description: 'Adresse e-mail du client' },
        },
        required: ['nom', 'date', 'heure', 'duree', 'email'],
      },
    },
  ]);
});

// 🔹 Outil MCP classique
app.post('/mcp_tool', (req, res) => {
  console.log('✅ Requête mcp_tool :', req.body);

  res.json({
    tool_response: `Bonjour${req.body?.nom ? ', ' + req.body.nom : ''} ! Je suis connecté à MCP avec succès.`,
  });
});

// 🔸 Outil de prise de RDV
app.post('/prise_rdv_tool', async (req, res) => {
  const { nom, date, heure, duree, email } = req.body;
  console.log('📅 Requête prise de RDV :', req.body);

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:D`,
    });

    const rendezVous = data.values || [];
    const existe = rendezVous.find(row => row[1] === date && row[2] === heure);

    if (existe) {
      return res.json({
        tool_response: `Désolé, le créneau du ${date} à ${heure} est déjà pris.`,
      });
    }

    // Ajout dans la feuille Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A2:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[nom, date, heure, duree]],
      },
    });

    // Envoi de l'e-mail avec Resend
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Confirmation de votre rendez-vous',
      text: `Bonjour ${nom},\n\nVotre rendez-vous est bien confirmé pour le ${date} à ${heure} (durée : ${duree} minutes).\n\nMerci de votre confiance.`,
    });

    return res.json({
      tool_response: `Rendez-vous confirmé pour ${nom}, le ${date} à ${heure} pendant ${duree} minutes. Un e-mail de confirmation a été envoyé à ${email}.`,
    });
  } catch (error) {
    console.error('❌ Erreur lors de la prise de rendez-vous :', error);
    return res.status(500).json({
      tool_response: "Une erreur s'est produite lors de la prise de rendez-vous.",
    });
  }
});

// 🟢 Flux SSE pour Vapi (route /)
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log('🟢 Connexion SSE établie');

  res.write(`event: message\ndata: {"status":"ready"}\n\n`);

  const keepAlive = setInterval(() => {
    res.write(`event: ping\ndata: \n\n`);
  }, 15000);

  req.on('close', () => {
    console.log('❌ Connexion SSE fermée');
    clearInterval(keepAlive);
  });
});

// 🚀 Lancement du serveur
app.listen(port, () => {
  console.log(`✅ Serveur MCP en écoute sur http://localhost:${port}`);
});
