require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const axios = require('axios');

// Connexion MongoDB
mongoose.connect('mongodb://localhost:27018/parking_db');

// Schema
const Parking = mongoose.model('Parking', new mongoose.Schema({
  placeId: Number,
  status: String,
  timestamp: Date
}));

async function getContext() {
  const data = await Parking.find()
    .sort({ timestamp: -1 })
    .limit(20);

  if (data.length === 0) {
    return "Aucune donnée disponible pour le moment.";
  }

  const occupied = data.filter(d => d.status === 'occupied').length;
  const free = data.filter(d => d.status === 'free').length;
  const total = data.length;

  return `
    Voici les dernières données du parking :
    - Total de lectures : ${total}
    - Places occupées : ${occupied}
    - Places libres : ${free}
    - Taux d'occupation : ${Math.round((occupied / total) * 100)}%
    - Dernière mise à jour : ${data[0].timestamp}
    - Détails : ${JSON.stringify(data.slice(0, 5))}
  `;
}

async function askRAG(question) {
  const context = await getContext();

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          {
            role: 'system',
            content: `Tu es un assistant intelligent pour un système de parking IoT.
          Tu analyses les données en temps réel et donnes des recommandations.
          Réponds toujours en français de façon claire et concise.
          Voici les données actuelles du parking :
          ${context}`
          },
          {
            role: 'user',
            content: question
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.warn("OpenRouter indisponible, utilisation d'une réponse locale.");
    return `Analyse locale du parking :
${context}

Question posée : ${question}

Le service de génération externe est temporairement indisponible, mais les données ci-dessus permettent déjà de suivre l'état du parking.`;
  }
}

// Test
async function main() {
  console.log("Connexion à MongoDB...");
  await new Promise(resolve => setTimeout(resolve, 2000));

  const question = "Quel est l'état actuel du parking et quelles sont tes recommandations ?";
  console.log("Question :", question);
  console.log("Réponse LLM en cours...");

  const reponse = await askRAG(question);
  console.log("\nRéponse :", reponse);

  mongoose.disconnect();
}

main().catch(console.error);