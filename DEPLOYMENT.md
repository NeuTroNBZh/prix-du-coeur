# 🚀 Guide de Déploiement

Ce guide vous aide à déployer Prix du Cœur en production.

## Déploiement avec PM2 (Recommandé)

### 1. Installation de PM2

```bash
npm install -g pm2
```

### 2. Configuration Backend

Créez le fichier `backend/ecosystem.config.js` :

```javascript
module.exports = {
  apps: [{
    name: 'prix-api',
    script: './src/index.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  }]
};
```

### 3. Démarrer l'API

```bash
cd backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Build Frontend

```bash
cd frontend
npm run build
```

### 5. Configuration Nginx

Créez `/etc/nginx/sites-available/prix-du-coeur` :

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Frontend
    root /var/www/html/prix-du-coeur/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css text/javascript application/javascript application/json;
}
```

Activez le site :

```bash
sudo ln -s /etc/nginx/sites-available/prix-du-coeur /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL avec Let's Encrypt (Recommandé)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

## Déploiement avec Docker (Alternative)

### 1. Créer Dockerfile Backend

`backend/Dockerfile` :

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3002

CMD ["node", "src/index.js"]
```

### 2. Créer Dockerfile Frontend

`frontend/Dockerfile` :

```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 3. Docker Compose

`docker-compose.yml` :

```yaml
version: '3.8'

services:
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: prix_du_coeur
      POSTGRES_USER: prix_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    networks:
      - prix-network

  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      DB_HOST: db
      DB_USER: prix_user
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: prix_du_coeur
      JWT_SECRET: ${JWT_SECRET}
      MISTRAL_API_KEY: ${MISTRAL_API_KEY}
    depends_on:
      - db
    networks:
      - prix-network

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - prix-network

volumes:
  postgres_data:

networks:
  prix-network:
    driver: bridge
```

### 4. Lancer avec Docker

```bash
docker-compose up -d
```

## Configuration de Production

### Variables d'environnement

Assurez-vous de configurer :

```bash
# Backend (.env)
NODE_ENV=production
FRONTEND_URL=https://votre-domaine.com
JWT_SECRET=<clé sécurisée 32+ caractères>
ENCRYPTION_KEY=<clé sécurisée 32 caractères>
MISTRAL_API_KEY=<votre clé Mistral>
DB_PASSWORD=<mot de passe fort>
```

### Sécurité

1. **Firewall** : Ouvrez seulement les ports 80 et 443
2. **PostgreSQL** : Désactivez l'accès externe
3. **SSL** : Utilisez Let's Encrypt pour HTTPS
4. **CORS** : Configurez uniquement vos domaines
5. **Rate Limiting** : Activé par défaut dans le backend
6. **Helmet** : Activé pour les headers de sécurité

### Monitoring

```bash
# Logs PM2
pm2 logs prix-api

# Monitoring
pm2 monit

# Redémarrage automatique
pm2 startup
pm2 save
```

### Sauvegarde Base de Données

```bash
# Backup
pg_dump -U prix_user prix_du_coeur > backup_$(date +%Y%m%d).sql

# Restore
psql -U prix_user prix_du_coeur < backup_20260128.sql
```

### Mise à jour

```bash
# 1. Sauvegarder la base de données
pg_dump -U prix_user prix_du_coeur > backup_avant_maj.sql

# 2. Pull les changements
git pull origin main

# 3. Backend
cd backend
npm install
pm2 restart prix-api

# 4. Frontend
cd ../frontend
npm install
npm run build

# 5. Reload nginx si nécessaire
sudo systemctl reload nginx
```

## Troubleshooting

### API ne démarre pas

```bash
# Vérifier les logs
pm2 logs prix-api --lines 100

# Vérifier les permissions
ls -la backend/logs/

# Vérifier PostgreSQL
sudo systemctl status postgresql
```

### Frontend ne charge pas

```bash
# Vérifier nginx
sudo nginx -t
sudo systemctl status nginx

# Vérifier les logs
sudo tail -f /var/log/nginx/error.log
```

### Base de données inaccessible

```bash
# Vérifier que PostgreSQL écoute
sudo netstat -plnt | grep 5432

# Vérifier les permissions
sudo -u postgres psql -d prix_du_coeur -c "\du"
```

## Performance

### Optimisations recommandées

1. **Nginx Caching** : Cache les assets statiques
2. **CDN** : Pour les fichiers JS/CSS
3. **PostgreSQL** : Index sur les colonnes fréquemment requêtées
4. **PM2 Cluster** : Plusieurs instances de l'API
5. **Compression** : Gzip activé sur nginx

### Index PostgreSQL recommandés

```sql
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_couple_id ON transactions(couple_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(type);
```

## Support

Pour toute question sur le déploiement :
- Consultez les issues GitHub
- Vérifiez la documentation
- Contactez les mainteneurs

---

Bon déploiement ! 🚀
