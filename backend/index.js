require('dotenv').config();
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const redis = require('redis');
const axios = require('axios');

// Connexion MongoDB
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/parking_db');

// Schema MongoDB
const parkingSchema = new mongoose.Schema({
  placeId: Number,
  status: String,
  timestamp: { type: Date, default: Date.now }
});
const Parking = mongoose.model('Parking', parkingSchema);

// Connexion Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.connect();

// Connexion MQTT
const mqttClient = mqtt.connect(
  process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com'
);

mqttClient.on('connect', () => {
  console.log('MQTT connecté !');
  mqttClient.subscribe('parking/update');
});

// Génère une recommandation basée sur l'état actuel
async function generateRecommendation(states) {
  const free = Object.values(states).filter(s => s === 'free').length;
  const occupied = Object.values(states).filter(s => s === 'occupied').length;
  const total = free + occupied;
  const rate = Math.round((occupied / total) * 100);

  const localReco = buildLocalReco(free, occupied, rate);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return localReco;

  try {
    const recent = await Parking.find().sort({ timestamp: -1 }).limit(10);
    const context = `Parking IoT — ${total} places total. Occupées: ${occupied}, Libres: ${free}, Taux: ${rate}%. Historique récent: ${JSON.stringify(recent.slice(0, 3))}`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3.2-3b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'Tu es un assistant IoT pour un parking intelligent. Donne une recommandation courte (2-3 phrases max) en français basée sur les données fournies.'
          },
          { role: 'user', content: context }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );
    return response.data.choices[0].message.content;
  } catch {
    return localReco;
  }
}

function buildLocalReco(free, occupied, rate) {
  if (free === 0) return `Parking complet (${occupied}/${occupied + free} places occupées). Barrière fermée. Rediriger les conducteurs vers un autre parking.`;
  if (rate >= 75) return `Parking presque plein — ${free} place(s) restante(s) sur ${free + occupied} (${rate}% d'occupation). Anticipez la saturation.`;
  if (rate <= 25) return `Parking largement disponible — ${free} place(s) libres sur ${free + occupied} (${rate}% d'occupation). Aucune action requise.`;
  return `Parking en cours d'utilisation — ${occupied} place(s) occupée(s), ${free} libre(s) (${rate}% d'occupation). Situation normale.`;
}

// État courant des places
const currentStates = {};
let recoTimer = null;

mqttClient.on('message', async (topic, message) => {
  const data = JSON.parse(message.toString());
  console.log('Message reçu:', data);

  // Mettre à jour l'état local
  currentStates[data.placeId] = data.status;

  // Sauvegarder dans MongoDB
  await Parking.create(data);
  console.log('Sauvegardé dans MongoDB');

  // Mettre en cache dans Redis
  await redisClient.set(
    `place:${data.placeId}`,
    JSON.stringify(data),
    { EX: 60 }
  );
  console.log('Mis en cache dans Redis');

  // Publier une recommandation (debounce 2s pour éviter spam)
  clearTimeout(recoTimer);
  recoTimer = setTimeout(async () => {
    const reco = await generateRecommendation(currentStates);
    console.log('Recommandation:', reco);
    mqttClient.publish('parking/recommendations', JSON.stringify({
      text: reco,
      timestamp: new Date().toISOString(),
      stats: {
        free: Object.values(currentStates).filter(s => s === 'free').length,
        occupied: Object.values(currentStates).filter(s => s === 'occupied').length
      }
    }), { retain: true });
  }, 2000);
});
