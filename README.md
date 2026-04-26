# 🅿️ Smart Parking IoT System

![ESP32](https://img.shields.io/badge/ESP32-IoT-blue?style=for-the-badge&logo=espressif)
![MQTT](https://img.shields.io/badge/MQTT-HiveMQ-orange?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green?style=for-the-badge&logo=mongodb)
![Redis](https://img.shields.io/badge/Redis-Cache-red?style=for-the-badge&logo=redis)
![Docker](https://img.shields.io/badge/Docker-Container-blue?style=for-the-badge&logo=docker)

> Système de gestion de parking intelligent en temps réel basé sur l'IoT.  
> L'ESP32 détecte l'occupation des places via des capteurs ultrasoniques, contrôle une barrière automatique, et publie les données via MQTT vers un backend Docker (MongoDB + Redis) et un dashboard web.

---

## 📸 Aperçu

### Simulation Wokwi
![Simulation](https://i.imgur.com/placeholder_wokwi.png)

### Dashboard Web
![Dashboard](https://i.imgur.com/placeholder_dashboard.png)

---

## 🏗️ Architecture du projet

```
ESP32 (Wokwi)
    │
    ├── HC-SR04 #1 (Place 1)     → GPIO 5/18
    ├── HC-SR04 #2 (Place 2)     → GPIO 19/21
    ├── HC-SR04 #3 (Barrière)    → GPIO 23/22
    └── Servo SG90 (Barrière)    → GPIO 27
         │
         │ WiFi + MQTT
         ▼
    HiveMQ Broker (broker.hivemq.com:1883)
    Topic: parking/update
         │
         ▼
    ┌─────────────────────────────────┐
    │         Docker Compose          │
    │                                 │
    │  ┌────────────┐                 │
    │  │  Backend   │ Node.js         │
    │  │  (port 3000)│                │
    │  └─────┬──────┘                 │
    │        │                        │
    │  ┌─────▼──────┐ ┌────────────┐  │
    │  │  MongoDB   │ │   Redis    │  │
    │  │ (port 27018)│ │(port 6379) │  │
    │  └────────────┘ └────────────┘  │
    └─────────────────────────────────┘
         │
         ▼
    Dashboard HTML (dashboard.html)
    Visualisation en temps réel
```

---

## 🧰 Technologies utilisées

| Technologie | Rôle |
|---|---|
| **ESP32** | Microcontrôleur WiFi — cerveau du système |
| **HC-SR04** | Capteur ultrasonique — détection de présence |
| **Servo SG90** | Moteur de la barrière d'entrée |
| **Arduino C++** | Langage de programmation du firmware |
| **Wokwi** | Simulateur IoT en ligne |
| **MQTT** | Protocole de communication IoT léger |
| **HiveMQ** | Broker MQTT public gratuit |
| **Node.js** | Backend serveur |
| **MongoDB** | Base de données — stockage des événements |
| **Redis** | Cache — accès rapide à l'état actuel |
| **Docker** | Conteneurisation du backend |
| **HTML/CSS/JS** | Dashboard de visualisation |
| **Chart.js** | Graphiques en temps réel |

---

## 📁 Structure du projet

```
iot-parking-system/
│
├── 📄 README.md                  # Documentation du projet
├── 📄 dashboard.html             # Interface web de visualisation
├── 📄 docker-compose.yml         # Orchestration des containers
│
└── 📁 backend/
    ├── 📄 Dockerfile             # Image Docker du backend
    ├── 📄 index.js               # Serveur Node.js (MQTT → MongoDB + Redis)
    ├── 📄 package.json           # Dépendances Node.js
    └── 📁 node_modules/          # Modules installés (ignoré par Git)
```

---

## ⚙️ Fonctionnement

### Logique principale

Toutes les **3 secondes**, l'ESP32 exécute ce cycle :

1. **Lecture** des 3 capteurs HC-SR04
2. **Décision** : si distance < 10 cm → objet détecté
3. **Publication** MQTT de l'état des places en JSON :
```json
{"placeId": 1, "status": "occupied"}
{"placeId": 2, "status": "free"}
```
4. **Contrôle barrière** :
   - Si (place1 libre **OU** place2 libre) **ET** voiture devant → Servo 90° (ouvert)
   - Sinon → Servo 0° (fermé)

### Brochage ESP32

| Composant | Broche TRIG | Broche ECHO |
|---|---|---|
| Capteur Place 1 | GPIO 5 | GPIO 18 |
| Capteur Place 2 | GPIO 19 | GPIO 21 |
| Capteur Barrière | GPIO 23 | GPIO 22 |
| Servo Barrière | GPIO 27 (PWM) | — |

---

## 🚀 Installation et lancement

### Prérequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop)
- [Node.js v18+](https://nodejs.org)
- [VS Code](https://code.visualstudio.com)

### Étapes

**1. Cloner le projet**
```bash
git clone https://github.com/ton-username/iot-parking-system.git
cd iot-parking-system
```

**2. Installer les dépendances backend**
```bash
cd backend
npm install
cd ..
```

**3. Lancer Docker (MongoDB + Redis + Backend)**
```bash
docker-compose up --build
```

**4. Vérifier que tout tourne**
```bash
docker logs parking_backend
```
Tu dois voir :
```
MQTT connecté !
Message reçu: { placeId: 1, status: 'free' }
Sauvegardé dans MongoDB
Mis en cache dans Redis
```

**5. Ouvrir le dashboard**

Ouvre `dashboard.html` dans ton navigateur.

**6. Lancer la simulation Wokwi**

Va sur [wokwi.com/projects/462377171452316673](https://wokwi.com/projects/462377171452316673) et clique sur ▶ Play.

---

## 🐳 Docker Compose — Services

| Service | Image | Port |
|---|---|---|
| `parking_mongodb` | mongo:latest | 27018:27017 |
| `parking_redis` | redis:latest | 6379:6379 |
| `parking_backend` | Node.js custom | 3000:3000 |

---

## 📊 Dashboard

Le dashboard affiche en temps réel :

- ✅ État de chaque place (LIBRE / OCCUPÉE)
- ✅ État de la barrière (OUVERTE / FERMÉE)
- ✅ Compteur de messages MQTT reçus
- ✅ Historique d'occupation (graphe linéaire)
- ✅ Répartition actuelle (graphe donut)
- ✅ Log des derniers messages MQTT

---

## 🧪 Tests

### Scénario 1 — Parking vide
- Tous les capteurs > 10 cm
- Résultat : Places **LIBRES**, barrière **OUVERTE** si voiture détectée

### Scénario 2 — Parking plein
- Capteurs 1 et 2 < 10 cm
- Résultat : Places **OCCUPÉES**, barrière **FERMÉE**

### Scénario 3 — Une place libre
- Capteur 1 < 10 cm, Capteur 2 > 10 cm
- Résultat : Place 1 **OCCUPÉE**, Place 2 **LIBRE**, barrière **OUVERTE**

---

## 🔮 Améliorations futures

- [ ] API REST pour lire l'historique depuis MongoDB
- [ ] LEDs rouge/vert pour indiquer l'état de chaque place
- [ ] Écran LCD affichant le nombre de places disponibles
- [ ] Notifications Telegram en cas de parking plein
- [ ] Authentification sur le dashboard
- [ ] Déploiement sur serveur cloud (AWS / Azure)

---

## 👨‍💻 Auteur

**Maamar** — Étudiant en 4ème année à l'EMSI  
Projet IoT — S8

---

## 📄 Licence

Ce projet est sous licence MIT — libre d'utilisation et de modification.