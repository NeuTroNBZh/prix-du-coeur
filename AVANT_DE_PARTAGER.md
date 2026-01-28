# ⚠️ CHECKLIST AVANT DE PARTAGER SUR GITHUB

## 🔒 Sécurité CRITIQUE

### ✅ Fichiers à vérifier

- [ ] **backend/.env** est dans .gitignore (ne sera PAS uploadé)
- [ ] **frontend/.env** est dans .gitignore (ne sera PAS uploadé)
- [ ] **backend/.env.example** existe avec des valeurs d'exemple
- [ ] **frontend/.env.example** existe avec des valeurs d'exemple
- [ ] Aucune clé API réelle dans le code source
- [ ] Aucun mot de passe en dur dans le code

### 🔑 Variables sensibles à remplacer

Dans **backend/.env.example**, vérifiez que ces valeurs sont des EXEMPLES :

```bash
JWT_SECRET=remplacez_par_une_cle_secrete_longue...
ENCRYPTION_KEY=remplacez_par_32_caracteres_hex
MISTRAL_API_KEY=votre_cle_api_mistral
DB_PASSWORD=VotreMotDePasseSecurise
SMTP_PASSWORD=votre_mot_de_passe_application
```

## 📝 Documentation

- [x] README.md complet avec instructions d'installation
- [x] CONTRIBUTING.md pour guider les contributeurs
- [x] LICENSE (MIT)
- [x] DEPLOYMENT.md pour le déploiement
- [x] .env.example dans backend/ et frontend/

## 🧪 Tests avant publication

```bash
# 1. Vérifier que l'installation fonctionne
./check-install.sh

# 2. Vérifier que .env n'est pas tracké
git status | grep -i ".env"
# Ne doit rien retourner ou seulement .env.example

# 3. Vérifier le .gitignore
cat .gitignore | grep -E "\.env$|node_modules"
```

## 🚀 Commandes pour publier sur GitHub

### 1. Créer le dépôt sur GitHub

Allez sur https://github.com/new et créez un nouveau dépôt nommé `prix-du-coeur`

### 2. Initialiser et pousser

```bash
cd /var/www/html/prix-du-coeur

# Initialiser git (si pas déjà fait)
git init

# Ajouter le remote
git remote add origin https://github.com/VOTRE-USERNAME/prix-du-coeur.git

# Ajouter tous les fichiers
git add .

# Vérifier ce qui sera commité (IMPORTANT !)
git status

# Vérifier qu'aucun fichier sensible n'est présent
git status | grep -E "\.env$"
# Ne doit rien retourner !

# Commit
git commit -m "Initial commit - Prix du Coeur v1.0"

# Pousser
git branch -M main
git push -u origin main
```

## 🔍 Dernière vérification

Après avoir poussé sur GitHub, vérifiez sur le site :

1. ✅ Le fichier `.env` n'apparaît PAS
2. ✅ Les fichiers `.env.example` sont présents
3. ✅ Le README est bien formaté
4. ✅ Pas de clés API visibles dans le code

## 📢 Après publication

1. Ajoutez une description au dépôt
2. Ajoutez des tags : `react`, `express`, `postgresql`, `expense-tracker`
3. Créez une release v1.0.0
4. Ajoutez un screenshot dans le README
5. Testez l'installation en suivant votre propre README

## 🎯 URL de votre dépôt

Une fois créé, votre projet sera à :
```
https://github.com/VOTRE-USERNAME/prix-du-coeur
```

Les autres pourront le cloner avec :
```bash
git clone https://github.com/VOTRE-USERNAME/prix-du-coeur.git
```

## ⚠️ IMPORTANT

**NE JAMAIS** commiter :
- Fichiers `.env` avec de vraies clés
- Dossier `node_modules/`
- Logs avec des données personnelles
- Dumps de base de données avec des vraies données

---

Bonne publication ! 🚀
