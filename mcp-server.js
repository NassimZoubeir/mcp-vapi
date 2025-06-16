const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// 🔧 Déclare les outils disponibles pour Vapi
app.get('/tools', (req, res) => {
  res.json([
    {
      name: 'mcp_tool',
      description: "Dit bonjour à l'utilisateur",
      parameters: {
        type: 'object',
        properties: {
          nom: { type: 'string', description: "Le nom de l'utilisateur" }
        },
        required: ['nom']
      }
    }
  ]);
});

// 🎯 Exécute le tool quand Vapi l'appelle
app.post('/mcp_tool', (req, res) => {
  console.log('✅ Requête reçue depuis Vapi :', req.body || '[Aucun body reçu]');

  res.json({
    tool_response: `Bonjour${req.body?.nom ? ', ' + req.body.nom : ''}! Je suis connecté à MCP avec succès.`
  });
});

// 🟢 Flux SSE pour indiquer que le serveur est prêt
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders();

  console.log('🟢 Connexion SSE entrante');

  // ✅ Message attendu par Vapi pour confirmer que le serveur est prêt
  res.write(`event: message\ndata: {"status":"ready"}\n\n`);

  // Ping toutes les 15 secondes pour garder la connexion ouverte
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
