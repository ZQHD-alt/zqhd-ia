# ZQHD.ia

Chat façon IA : les messages des utilisateurs arrivent en temps réel dans une
console admin (`/admin`), où tu peux répondre manuellement — ou laisser l'IA
répondre automatiquement si tu actives ce mode pour une conversation.

## Structure du projet

```
zqhd-ia/
├── server.js           # serveur Express + Socket.IO
├── lib/
│   ├── store.js         # stockage en mémoire des conversations
│   └── ai.js             # appel à l'API Anthropic (optionnel)
├── public/
│   ├── index.html / style.css / chat.js     # page utilisateur "/"
│   └── admin.html / admin.css / admin.js    # console "/admin"
├── package.json
└── .env.example
```

⚠️ **Stockage en mémoire** : les conversations sont perdues si le serveur
redémarre (redéploiement, veille d'un hébergeur gratuit, etc.). Suffisant pour
une blague entre amis. Si tu veux que ça persiste, dis-le moi, je peux
brancher une petite base (SQLite / Supabase gratuit).

---

## 1. Tester en local

```bash
cd zqhd-ia
npm install
cp .env.example .env
```

Édite `.env` :
- `ADMIN_PASSWORD` → choisis un vrai mot de passe.
- `SESSION_SECRET` → génère une valeur avec :
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `ANTHROPIC_API_KEY` → laisse vide si tu ne veux pas activer les réponses IA
  automatiques pour l'instant (tu pourras l'ajouter plus tard).

Lance le serveur :

```bash
npm start
```

Puis ouvre :
- `http://localhost:3000/` → le chat utilisateur
- `http://localhost:3000/admin` → la console (mot de passe = `ADMIN_PASSWORD`)

Écris un message côté utilisateur, il doit apparaître instantanément dans la
console admin. Réponds depuis l'admin, la réponse doit apparaître côté
utilisateur après l'animation "ZQHD.ia réfléchit…".

---

## 2. Créer le dépôt GitHub

```bash
cd zqhd-ia
git init
git add .
git commit -m "ZQHD.ia - version initiale"
```

Sur github.com : **New repository** → nomme-le `zqhd-ia` → ne coche
**aucune** case (pas de README/gitignore, tu les as déjà) → **Create
repository**. GitHub t'affiche alors les commandes, en résumé :

```bash
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/zqhd-ia.git
git push -u origin main
```

Ton fichier `.env` ne partira jamais sur GitHub (il est dans `.gitignore`) —
c'est voulu, le mot de passe et la clé API ne doivent jamais être publiés.

---

## 3. Héberger gratuitement : Render.com

Render propose un plan gratuit simple, qui gère WebSockets (nécessaire pour
Socket.IO) sans configuration compliquée.

1. Va sur **render.com** → crée un compte (tu peux te connecter avec GitHub).
2. **New +** → **Web Service**.
3. Connecte ton dépôt GitHub `zqhd-ia`.
4. Configure :
   - **Name** : `zqhd-ia` (ou ce que tu veux)
   - **Region** : la plus proche de toi/tes amis
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : `Free`
5. **Advanced** → **Add Environment Variable**, ajoute :
   - `ADMIN_PASSWORD` = ton mot de passe
   - `SESSION_SECRET` = la chaîne générée plus haut
   - `ANTHROPIC_API_KEY` = ta clé (si tu veux l'IA — voir section 6)
   - `ANTHROPIC_MODEL` = `claude-sonnet-5`
   - `NODE_ENV` = `production`
   - (ne mets **pas** `PORT`, Render le fournit automatiquement)
6. **Create Web Service**. Render installe et démarre le projet (1–3 min).

## 4. Obtenir l'URL finale

Une fois le déploiement terminé, Render affiche une URL du type :

```
https://zqhd-ia.onrender.com
```

- Chat utilisateur : `https://zqhd-ia.onrender.com/`
- Console admin : `https://zqhd-ia.onrender.com/admin`

⚠️ Le plan gratuit de Render **met le service en veille après ~15 min sans
trafic**. Le premier message après une veille peut mettre 30–50 secondes à
arriver (le temps que le serveur redémarre) — normal, pas un bug.

---

## 5. Tester entre deux appareils

1. Sur ton téléphone : ouvre `https://zqhd-ia.onrender.com/` et envoie un
   message.
2. Sur ton PC : ouvre `https://zqhd-ia.onrender.com/admin`, connecte-toi avec
   `ADMIN_PASSWORD`.
3. La conversation doit apparaître dans la liste à gauche avec un aperçu du
   message.
4. Clique dessus, écris une réponse, envoie.
5. Sur le téléphone : l'animation "ZQHD.ia réfléchit…" doit s'afficher
   pendant 1 à 2 secondes, puis ta réponse apparaît comme un message de
   ZQHD.ia.

---

## 6. Activer les réponses IA automatiques (optionnel)

Si tu veux que ZQHD.ia puisse répondre toute seule sur certaines
conversations :

1. Crée une clé API sur **console.anthropic.com** (section *API Keys*).
2. Ajoute-la comme variable d'environnement `ANTHROPIC_API_KEY` sur Render
   (voir étape 5 ci-dessus), puis redéploie (Render le fait automatiquement
   dès qu'une variable change).
3. Dans la console admin, ouvre une conversation → coche **"Réponse IA
   automatique"**. Les prochains messages de l'utilisateur recevront une
   réponse générée automatiquement (avec la même animation "réfléchit…").
4. Tu peux aussi laisser une conversation en mode manuel et cliquer sur
   **"✨ Suggérer (IA)"** : ça remplit le champ de réponse avec une
   proposition que tu peux modifier avant d'envoyer — pratique pour
   gagner du temps sans perdre le contrôle.

Le bouton IA ne fait rien si `ANTHROPIC_API_KEY` n'est pas configurée (pas
d'erreur bloquante, juste un message d'erreur clair dans la console admin).

---

## Notes

- Le stockage étant en mémoire, redéployer sur Render (ou une mise en veille
  suivie d'un redémarrage) efface l'historique. Pour un usage ponctuel entre
  amis ça ne pose pas de problème.
- N'utilise pas cet outil pour collecter des mots de passe ou des données
  personnelles sensibles — l'historique n'est pas chiffré et l'ID de
  conversation stocké dans le navigateur suffit à retrouver les messages
  (`/api/conversations/:id/messages`), ce qui est volontairement simple pour
  un projet entre amis, pas conçu pour de la donnée sensible.
