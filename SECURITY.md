# Politique de Sécurité - Prix du Cœur 💖

La sécurité de vos données financières et de vos clés d'API est notre priorité absolue. Ce document explique comment nous traitons les vulnérabilités et quelles sont les meilleures pratiques pour utiliser cette application.

## ⚠️ Avertissement Important

**Prix du Cœur** est un outil de gestion personnelle. 
- Ne partagez jamais votre fichier `.env` ou vos clés `MISTRAL_API_KEY`, `JWT_SECRET` et `ENCRYPTION_KEY`.
- Assurez-vous que votre base de données PostgreSQL n'est pas accessible publiquement sur internet sans pare-feu strict.

## Versions Supportées

Actuellement, seule la version principale (main branch) bénéficie de mises à jour de sécurité.

| Version | Supportée          |
| ------- | ------------------ |
| v1.0.x  | ✅ Oui              |
| < 1.0   | ❌ Non              |

## Signaler une vulnérabilité

Si vous découvrez une faille de sécurité (exposition de données, injection SQL, faille XSS, etc.), merci de ne **pas** ouvrir d'Issue publique. 

Veuillez suivre cette procédure :

1. Envoyez un e-mail à : **louis.cercle35@gmail.com** (ou via la messagerie de mon profil GitHub).
2. Décrivez précisément la vulnérabilité et les étapes pour la reproduire.
3. Je m'engage à accuser réception sous 48h et à proposer un correctif dans les plus brefs délais.

## Bonnes Pratiques de Déploiement

Pour garantir la sécurité de votre instance "Prix du Cœur" :

1. **Chiffrement :** Utilisez une `ENCRYPTION_KEY` de 32 caractères générée aléatoirement via la commande fournie dans le README.
2. **Secrets :** Changez régulièrement votre `JWT_SECRET`.
3. **Double Authentification (2FA) :** Nous recommandons fortement d'activer l'option TOTP disponible dans les réglages de votre compte utilisateur.
4. **Mises à jour :** Surveillez les alertes **Dependabot** sur GitHub pour mettre à jour les dépendances vulnérables.

## Gestion des données bancaires

L'application parse les fichiers CSV/PDF localement sur votre serveur. Les données ne sont jamais envoyées à des serveurs tiers, à l'exception des descriptions de transactions envoyées à **Mistral AI** pour la catégorisation (si l'option est activée). Aucune information nominative ou numéro de compte n'est envoyé à l'IA.

---
Merci de nous aider à garder "Prix du Cœur" en sécurité ! 🛡️
