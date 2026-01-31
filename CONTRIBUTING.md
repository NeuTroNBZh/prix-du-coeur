# Guide de Contribution

Merci de votre intérêt pour contribuer à Prix du Cœur ! 🎉

## Comment contribuer

### 1. Signaler un bug

- Vérifiez d'abord que le bug n'a pas déjà été signalé dans les [Issues](https://github.com/NeuTroNBZh/prix-du-coeur/issues)
- Ouvrez une nouvelle issue avec le label `bug`
- Décrivez le problème en détail :
  - Étapes pour reproduire
  - Comportement attendu
  - Comportement observé
  - Captures d'écran si pertinent
  - Environnement (OS, navigateur, version)

### 2. Proposer une fonctionnalité

- Ouvrez une issue avec le label `enhancement`
- Décrivez la fonctionnalité et son utilité
- Expliquez comment elle devrait fonctionner
- Attendez les retours avant de commencer le développement

### 3. Soumettre du code

#### Forker et cloner

```bash
# Forker le projet sur GitHub
# Puis cloner votre fork
git clone https://github.com/NeuTroNBZh/prix-du-coeur.git
cd prix-du-coeur
```

#### Créer une branche

```bash
# Créer une branche pour votre fonctionnalité/correction
git checkout -b feature/ma-super-fonctionnalite
# ou
git checkout -b fix/correction-bug
```

#### Développer

- Suivez les conventions de code du projet
- Écrivez des messages de commit clairs
- Testez votre code
- Ajoutez de la documentation si nécessaire

#### Conventions de code

**Backend (JavaScript) :**
- Utilisez ESLint
- Nommage en camelCase
- Commentaires en français ou anglais
- Async/await plutôt que callbacks

**Frontend (React) :**
- Composants fonctionnels avec hooks
- Nommage en PascalCase pour les composants
- Props destructurées
- TailwindCSS pour le style

#### Messages de commit

Utilisez des messages clairs et descriptifs :

```
feat: ajout de l'export PDF des transactions
fix: correction du calcul d'harmonisation
docs: mise à jour du README
refactor: amélioration du parser CSV
test: ajout de tests pour les abonnements
```

#### Soumettre une Pull Request

```bash
# Pusher votre branche
git push origin feature/ma-super-fonctionnalite
```

Puis sur GitHub :
1. Ouvrez une Pull Request
2. Décrivez les changements
3. Liez l'issue associée si applicable
4. Attendez la revue de code

### 4. Revue de code

- Les mainteneurs examineront votre PR
- Répondez aux commentaires
- Apportez les modifications demandées
- Une fois approuvée, votre PR sera mergée !

## Standards de qualité

### Tests

- Ajoutez des tests pour les nouvelles fonctionnalités
- Assurez-vous que tous les tests passent

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

### Sécurité

- Ne commitez JAMAIS de clés API, mots de passe, ou tokens
- Utilisez toujours `.env` pour les données sensibles
- Vérifiez le `.gitignore` avant de commit

### Documentation

- Documentez les fonctions complexes
- Mettez à jour le README si nécessaire
- Ajoutez des commentaires en français ou anglais

## Questions ?

- Ouvrez une issue avec le label `question`
- Contactez les mainteneurs

Merci pour votre contribution ! 💖
