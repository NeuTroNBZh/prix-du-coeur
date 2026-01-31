/**
 * Mistral AI Client Service
 * Classification automatique des transactions bancaires
 */

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Get API key dynamically to ensure dotenv is loaded
const getApiKey = () => process.env.MISTRAL_API_KEY;
const getModel = () => process.env.MISTRAL_MODEL || 'mistral-small-latest';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

/**
 * Sleep for a given number of milliseconds
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (url, options, timeout = TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`API timeout after ${timeout}ms`);
    }
    throw error;
  }
};

/**
 * Call Mistral API with retry logic (exponential backoff)
 */
const callMistralAPI = async (messages, retryCount = 0) => {
  const apiKey = getApiKey();
  const model = getModel();
  
  if (!apiKey || apiKey === 'votre_cle_mistral_gratuite') {
    throw new Error('MISTRAL_API_KEY not configured. Please set it in .env file.');
  }

  try {
    const response = await fetchWithTimeout(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.1, // Low temperature for consistent classification
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Mistral API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;

  } catch (error) {
    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY_MS * Math.pow(2, retryCount);
      console.log(`Mistral API call failed, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return callMistralAPI(messages, retryCount + 1);
    }
    
    throw error;
  }
};

/**
 * Get system prompt for users who ARE in a couple
 */
const getSystemPromptForCouple = (userNameContext) => `Tu es un assistant spécialisé dans la classification des transactions bancaires pour un couple français.
Tu dois classifier chaque transaction en analysant ATTENTIVEMENT le libellé complet.

RÈGLES D'ANALYSE DES LIBELLÉS:

🔄 VIREMENTS INTERNES (TRÈS IMPORTANT - type=virement_interne):
C'est un virement entre les propres comptes de la même personne. Détecte ces cas:
- "Virement vers" suivi d'un numéro IBAN ou référence compte
- "VIR SEPA" vers/depuis "REVOLUT", "N26", "BOURSORAMA", "FORTUNEO" (néobanques)
- "Virement émis" vers un compte personnel
- "TOPUP" ou "TOP UP" (rechargement de compte)
- "From" suivi d'un prénom personnel (virement depuis son propre autre compte)
- Montant identique entrant/sortant sur la même période
- "Epargne", "LEP", "Livret A", "LDD", "PEL" (épargne)
- Virements réguliers de montants ronds (100€, 200€, 500€...) vers/depuis néobanques
- "CREDIT AGRICOLE", "CA" combiné avec "REVOLUT", "N26" ou autre banque
- Le mot "TRANSFERT" ou "TRANSFER" entre comptes
- "Virement vers" suivi du PRÉNOM ou NOM de l'utilisateur (virement vers son propre compte dans une autre banque)

Ces virements ne sont PAS des dépenses ni des revenus, ils sont neutres pour le budget.

Pour les autres VIREMENTS (VIR SEPA, Virement vers, Virement émis):
- Regarde le DESTINATAIRE complet après "Virement vers", "VIR SEPA"
- "SCI", "SAS", "SARL", "AGENCE", "IMMO", "HABITAT" → type=commune, catégorie=Logement (c'est un loyer)
- Prénom seul ou nom de personne physique → type=individuelle, catégorie=Cadeaux
- "LOYER" dans le libellé → type=commune, catégorie=Logement
- Ton propre compte ou épargne → type=virement_interne, catégorie=Virement interne

Pour les PRÉLÈVEMENTS et FACTURES (type=abonnement généralement):
- "EDF", "ENGIE", "GAZ", "ÉLECTRICITÉ", "VEOLIA", "EAU" → commune, Logement
- "ORANGE", "FREE", "SFR", "BOUYGUES", "TELECOM", "MOBILE" → abonnement, Abonnements
- "NETFLIX", "SPOTIFY", "DISNEY", "AMAZON PRIME", "APPLE" → abonnement, Loisirs
- "CPAM", "MUTUELLE", "AXA", "ALLIANZ", "MAIF" santé/assurance → commune, Santé
- "SNCF", "RATP", "NAVIGO", "UBER", "LIME" → commune, Transport
- "SALLE", "FITNESS", "SPORT", "GYM" → individuelle ou commune selon montant, Loisirs

Pour les ACHATS CARTE (CB, CARTE):
- Supermarchés: CARREFOUR, LECLERC, LIDL, ALDI, INTERMARCHE, CASINO, MONOPRIX → commune, Courses
- BOULANGERIE, PATISSERIE, EPICERIE → commune, Courses
- Restaurants: nom + ville, UBER EATS, DELIVEROO, JUST EAT → commune, Restaurant
- Mode: ZARA, H&M, DECATHLON, KIABI, PRIMARK → individuelle, Shopping
- AMAZON, FNAC, DARTY (électronique) → individuelle sauf gros montant
- PHARMACIE, PARAPHARMACIE → commune, Santé

RÈGLES DE TYPE (commune vs individuelle vs virement_interne):
- "commune" = dépense qui profite au couple (logement, courses, factures, sorties à deux, électroménager)
- "individuelle" = dépense personnelle (vêtements perso, cadeaux, abonnement perso, loisir solo)
- "abonnement" = prélèvement récurrent fixe mensuel (téléphone, streaming, salle de sport)
- "virement_interne" = transfert entre ses propres comptes (n'affecte pas le budget global)
- REVENUS: Les montants POSITIFS (salaires, remboursements, virements reçus) sont TOUJOURS type="individuelle", catégorie="Revenus"
  SAUF si c'est un virement interne (depuis un autre compte perso) → type="virement_interne"

CATÉGORIES POSSIBLES:
Courses, Restaurant, Transport, Logement, Loisirs, Santé, Shopping, Abonnements, Vacances, Cadeaux, Revenus, Virement interne, Autre

CONFIANCE (0-100):
- 90-100: Mots-clés très clairs (CARREFOUR → Courses)
- 70-89: Déduction logique mais pas certaine
- 50-69: Incertain, besoin de contexte utilisateur
- <50: Vraiment pas sûr

🔁 RÉCURRENT (isRecurring: true/false):
Indique si la transaction est un paiement récurrent régulier (type abonnement ou engagement).
MARQUE isRecurring=true pour:
- Abonnements: Netflix, Spotify, Disney+, Amazon Prime, Apple, Basic Fit, salle de sport, téléphone/mobile
- Factures régulières: EDF, Engie, eau, électricité, gaz
- Loyers et charges: tout virement vers SCI, SARL immobilière, bailleur, "LOYER"
- Assurances: MAIF, MACIF, AXA, MMA, GMF, mutuelle, CPAM (prélevé mensuellement)
- Transport: abonnement NAVIGO, SNCF MAX, péage automatique
- Crédits: remboursement crédit, prêt
- Écoles/formation: frais scolaires réguliers, cantine, garderie
- Amazon >60€ = probablement Prime annuel → isRecurring=true

MARQUE isRecurring=false pour:
- Achats ponctuels même récurrents (café quotidien, boulangerie, supermarché)
- Virements internes
- Achats Amazon <60€ (c'est un achat normal, pas l'abonnement)
- Restaurants et loisirs ponctuels
- Shopping et cadeaux

⚠️ IMPORTANT: Si l'utilisateur a corrigé des transactions similaires, RESPECTE ABSOLUMENT ses choix !
Par exemple si "VIR SEPA SARL IMMO" a été corrigé en "commune/Logement", applique ça aux transactions similaires.
${userNameContext}

Réponds UNIQUEMENT en JSON valide:
{
  "type": "commune|individuelle|abonnement|virement_interne",
  "category": "catégorie exacte de la liste",
  "confidence": 85,
  "isRecurring": true,
  "reasoning": "Explication courte en français"
}`;

/**
 * Get system prompt for SINGLE users (NOT in a couple)
 * No "commune" type allowed - everything is "individuelle" or "virement_interne"
 */
const getSystemPromptForSingle = (userNameContext) => `Tu es un assistant spécialisé dans la classification des transactions bancaires pour une personne célibataire en France.
Tu dois classifier chaque transaction en analysant ATTENTIVEMENT le libellé complet.

⚠️ IMPORTANT: Cette personne N'EST PAS en couple. Il n'y a JAMAIS de dépenses "commune".
Toutes les dépenses sont individuelles ou des virements internes.

RÈGLES D'ANALYSE DES LIBELLÉS:

🔄 VIREMENTS INTERNES (TRÈS IMPORTANT - type=virement_interne):
C'est un virement entre les propres comptes de la même personne. Détecte ces cas:
- "Virement vers" suivi d'un numéro IBAN ou référence compte
- "VIR SEPA" vers/depuis "REVOLUT", "N26", "BOURSORAMA", "FORTUNEO" (néobanques)
- "Virement émis" vers un compte personnel
- "TOPUP" ou "TOP UP" (rechargement de compte)
- "From" suivi d'un prénom personnel (virement depuis son propre autre compte)
- "Epargne", "LEP", "Livret A", "LDD", "PEL" (épargne)
- Virements réguliers de montants ronds (100€, 200€, 500€...) vers/depuis néobanques
- "CREDIT AGRICOLE", "CA" combiné avec "REVOLUT", "N26" ou autre banque
- Le mot "TRANSFERT" ou "TRANSFER" entre comptes
- "Virement vers" suivi du PRÉNOM ou NOM de l'utilisateur

Ces virements ne sont PAS des dépenses ni des revenus, ils sont neutres pour le budget.

Pour les VIREMENTS (VIR SEPA, Virement vers, Virement émis):
- "SCI", "SAS", "SARL", "AGENCE", "IMMO", "HABITAT" → type=individuelle, catégorie=Logement (loyer)
- "LOYER" dans le libellé → type=individuelle, catégorie=Logement
- Prénom seul ou nom de personne physique → type=individuelle, catégorie=Cadeaux
- Ton propre compte ou épargne → type=virement_interne, catégorie=Virement interne

Pour les PRÉLÈVEMENTS et FACTURES:
- "EDF", "ENGIE", "GAZ", "ÉLECTRICITÉ", "VEOLIA", "EAU" → individuelle, Logement
- "ORANGE", "FREE", "SFR", "BOUYGUES", "TELECOM", "MOBILE" → abonnement, Abonnements
- "NETFLIX", "SPOTIFY", "DISNEY", "AMAZON PRIME", "APPLE" → abonnement, Loisirs
- "CPAM", "MUTUELLE", "AXA", "ALLIANZ", "MAIF" → individuelle, Santé
- "SNCF", "RATP", "NAVIGO", "UBER", "LIME" → individuelle, Transport
- "SALLE", "FITNESS", "SPORT", "GYM" → abonnement, Loisirs

Pour les ACHATS CARTE (CB, CARTE):
- Supermarchés: CARREFOUR, LECLERC, LIDL, ALDI, INTERMARCHE, CASINO, MONOPRIX → individuelle, Courses
- BOULANGERIE, PATISSERIE, EPICERIE → individuelle, Courses
- Restaurants: nom + ville, UBER EATS, DELIVEROO, JUST EAT → individuelle, Restaurant
- Mode: ZARA, H&M, DECATHLON, KIABI, PRIMARK → individuelle, Shopping
- AMAZON, FNAC, DARTY (électronique) → individuelle, Shopping
- PHARMACIE, PARAPHARMACIE → individuelle, Santé

RÈGLES DE TYPE (ATTENTION: PAS de "commune" car utilisateur célibataire):
- "individuelle" = toute dépense personnelle
- "abonnement" = prélèvement récurrent fixe mensuel (téléphone, streaming, salle de sport)
- "virement_interne" = transfert entre ses propres comptes (n'affecte pas le budget global)
- REVENUS: Les montants POSITIFS (salaires, remboursements) sont type="individuelle", catégorie="Revenus"
  SAUF si c'est un virement interne (depuis un autre compte perso) → type="virement_interne"

⚠️ NE JAMAIS utiliser type="commune" - L'utilisateur n'est pas en couple.

CATÉGORIES POSSIBLES:
Courses, Restaurant, Transport, Logement, Loisirs, Santé, Shopping, Abonnements, Vacances, Cadeaux, Revenus, Virement interne, Autre

CONFIANCE (0-100):
- 90-100: Mots-clés très clairs (CARREFOUR → Courses)
- 70-89: Déduction logique mais pas certaine
- 50-69: Incertain, besoin de contexte utilisateur
- <50: Vraiment pas sûr

🔁 RÉCURRENT (isRecurring: true/false):
Indique si la transaction est un paiement récurrent régulier (type abonnement ou engagement).
MARQUE isRecurring=true pour:
- Abonnements: Netflix, Spotify, Disney+, Amazon Prime, Apple, Basic Fit, salle de sport, téléphone/mobile
- Factures régulières: EDF, Engie, eau, électricité, gaz
- Loyers et charges: tout virement vers SCI, SARL immobilière, bailleur, "LOYER"
- Assurances: MAIF, MACIF, AXA, MMA, GMF, mutuelle, CPAM (prélevé mensuellement)
- Transport: abonnement NAVIGO, SNCF MAX, péage automatique
- Crédits: remboursement crédit, prêt
- Écoles/formation: frais scolaires réguliers, cantine, garderie
- Amazon >60€ = probablement Prime annuel → isRecurring=true

MARQUE isRecurring=false pour:
- Achats ponctuels même récurrents (café quotidien, boulangerie, supermarché)
- Virements internes
- Achats Amazon <60€ (c'est un achat normal, pas l'abonnement)
- Restaurants et loisirs ponctuels
- Shopping et cadeaux

⚠️ IMPORTANT: Si l'utilisateur a corrigé des transactions similaires, RESPECTE ABSOLUMENT ses choix !
${userNameContext}

Réponds UNIQUEMENT en JSON valide:
{
  "type": "individuelle|abonnement|virement_interne",
  "category": "catégorie exacte de la liste",
  "confidence": 85,
  "isRecurring": true,
  "reasoning": "Explication courte en français"
}`;

/**
 * Classify a single transaction
 * Returns: { type, category, confidence, reasoning }
 * @param {Object} transaction - Transaction to classify
 * @param {Array} learningContext - Previous user corrections
 * @param {Object} userInfo - User info {firstName, lastName} for internal transfer detection
 */
const classifyTransaction = async (transaction, learningContext = [], userInfo = null) => {
  // Check if user is in a couple (default true for backwards compatibility)
  const isInCouple = userInfo?.isInCouple !== false;
  
  // Build dynamic user name context for internal transfer detection
  let userNameContext = '';
  if (userInfo && (userInfo.firstName || userInfo.lastName)) {
    userNameContext = `\n\n🔑 INFORMATION UTILISATEUR (pour détecter les virements vers soi-même):
- Prénom: ${userInfo.firstName || 'inconnu'}
- Nom: ${userInfo.lastName || 'inconnu'}
- Si un virement contient ce prénom OU ce nom dans le destinataire, c'est un VIREMENT INTERNE (vers son propre autre compte)`;
  }

  // Different prompts for single users vs couples
  const systemPrompt = isInCouple 
    ? getSystemPromptForCouple(userNameContext)
    : getSystemPromptForSingle(userNameContext);

  // Add learning context if available
  let userPrompt = `Classifie cette transaction:\n`;
  userPrompt += `- Libellé: "${transaction.label}"\n`;
  userPrompt += `- Montant: ${transaction.amount}€\n`;
  userPrompt += `- Date: ${transaction.date}\n`;

  if (learningContext.length > 0) {
    userPrompt += `\nContexte d'apprentissage (corrections précédentes de l'utilisateur):\n`;
    learningContext.forEach(ctx => {
      userPrompt += `- "${ctx.label}" → ${ctx.type} (${ctx.category})\n`;
    });
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  const response = await callMistralAPI(messages);
  
  try {
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    
    // Check if it's an internal transfer first
    const isInternalTransfer = result.type === 'virement_interne' || result.category === 'Virement interne';
    
    // Force revenues (positive amounts) to be individual, UNLESS it's an internal transfer
    const isRevenue = parseFloat(transaction.amount) > 0;
    
    // Determine if recurring (never for revenues or internal transfers)
    const isRecurring = isInternalTransfer || isRevenue ? false : (result.isRecurring === true);
    
    // Validate and normalize
    return {
      type: isInternalTransfer ? 'virement_interne' : (isRevenue ? 'individuelle' : (['commune', 'individuelle', 'abonnement', 'virement_interne'].includes(result.type) 
        ? result.type 
        : 'individuelle')),
      category: isInternalTransfer ? 'Virement interne' : (isRevenue ? 'Revenus' : (result.category || 'Autre')),
      confidence: isInternalTransfer ? 90 : (isRevenue ? 95 : Math.min(100, Math.max(0, parseInt(result.confidence) || 50))),
      reasoning: isInternalTransfer ? 'Virement entre comptes personnels' : (isRevenue ? 'Revenu automatiquement classé comme individuel' : (result.reasoning || '')),
      isRecurring: isRecurring
    };
  } catch (parseError) {
    console.error('Failed to parse Mistral response:', response);
    // Default classification if parsing fails
    const isRevenue = parseFloat(transaction.amount) > 0;
    return {
      type: 'individuelle',
      category: isRevenue ? 'Revenus' : 'Autre',
      confidence: 30,
      reasoning: 'Classification par défaut (erreur de parsing)',
      isRecurring: false
    };
  }
};

/**
 * Classify a batch of transactions
 * More efficient: sends multiple transactions in one API call
 * @param {Array} transactions - Transactions to classify
 * @param {Array} learningContext - Previous user corrections
 * @param {Object} userInfo - User info {firstName, lastName} for internal transfer detection
 */
const classifyTransactionsBatch = async (transactions, learningContext = [], userInfo = null) => {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  // For small batches, use single API call with all transactions
  if (transactions.length <= 10) {
    return classifyBatchSingleCall(transactions, learningContext, userInfo);
  }

  // For larger batches, split into chunks of 10
  const results = [];
  const chunkSize = 10;
  
  for (let i = 0; i < transactions.length; i += chunkSize) {
    const chunk = transactions.slice(i, i + chunkSize);
    const chunkResults = await classifyBatchSingleCall(chunk, learningContext, userInfo);
    results.push(...chunkResults);
    
    // Small delay between chunks to avoid rate limiting
    if (i + chunkSize < transactions.length) {
      await sleep(500);
    }
  }
  
  return results;
};

/**
 * Classify multiple transactions in a single API call
 * @param {Array} transactions - Transactions to classify
 * @param {Array} learningContext - Previous user corrections
 * @param {Object} userInfo - User info {firstName, lastName} for internal transfer detection
 */
const classifyBatchSingleCall = async (transactions, learningContext = [], userInfo = null) => {
  // Build user name context for internal transfer detection
  let userNameContext = '';
  if (userInfo && (userInfo.firstName || userInfo.lastName)) {
    userNameContext = `\n\n🔑 INFORMATION UTILISATEUR (pour détecter les virements vers soi-même):
- Prénom: ${userInfo.firstName || 'inconnu'}
- Nom: ${userInfo.lastName || 'inconnu'}
- Si un virement contient ce prénom OU ce nom dans le destinataire (ex: "Virement vers ${userInfo.firstName || 'Louis'}"), c'est un VIREMENT INTERNE → type=virement_interne, category=Virement interne`;
  }

  const systemPrompt = `Tu es un assistant spécialisé dans la classification des transactions bancaires pour un couple.

Pour CHAQUE transaction, tu dois déterminer:
1. TYPE: "commune" (partagée), "individuelle" (personnelle), "abonnement" (récurrent), ou "virement_interne" (entre ses propres comptes)
2. CATÉGORIE: Courses, Restaurant, Transport, Logement, Loisirs, Santé, Shopping, Abonnements, Vacances, Cadeaux, Revenus, Virement interne, Autre
3. CONFIANCE: 0-100
4. isRecurring: true/false - est-ce un paiement récurrent régulier?

🔄 VIREMENTS INTERNES (type=virement_interne):
- Virements entre ses propres comptes (Revolut, N26, Boursorama, épargne...)
- Virements où le destinataire contient le prénom ou nom de l'utilisateur
- TOPUP, TRANSFER, transfert vers néobanque

🔁 RÉCURRENT (isRecurring: true):
- Abonnements: Netflix, Spotify, Disney+, Amazon Prime (>60€), Apple, Basic Fit, salle de sport, téléphone
- Factures régulières: EDF, Engie, eau, électricité, gaz
- Loyers: virement vers SCI, SARL immobilière, bailleur, "LOYER"
- Assurances: MAIF, MACIF, AXA, mutuelle
- Crédits et prêts
- Frais scolaires réguliers, cantine

NON RÉCURRENT (isRecurring: false):
- Achats ponctuels (café, boulangerie, supermarché, restaurant)
- Virements internes
- Amazon <60€ (achat normal, pas Prime)
- Shopping et cadeaux
${userNameContext}

Réponds UNIQUEMENT avec un tableau JSON valide:
[
  {"id": 1, "type": "...", "category": "...", "confidence": 85, "isRecurring": true, "reasoning": "..."},
  {"id": 2, "type": "...", "category": "...", "confidence": 90, "isRecurring": false, "reasoning": "..."}
]`;

  let userPrompt = `Classifie ces ${transactions.length} transactions:\n\n`;
  
  transactions.forEach((tx, index) => {
    userPrompt += `${index + 1}. Libellé: "${tx.label}" | Montant: ${tx.amount}€ | Date: ${tx.date}\n`;
  });

  if (learningContext.length > 0) {
    userPrompt += `\nContexte d'apprentissage (corrections utilisateur):\n`;
    learningContext.slice(0, 10).forEach(ctx => {
      userPrompt += `- "${ctx.label}" → ${ctx.type} (${ctx.category})\n`;
    });
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const response = await callMistralAPI(messages);
    
    // Parse JSON array response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    
    const results = JSON.parse(jsonMatch[0]);
    
    // Map results back to transactions
    return transactions.map((tx, index) => {
      const result = results.find(r => r.id === index + 1) || results[index] || {};
      
      // Check if it's an internal transfer
      const isInternalTransfer = result.type === 'virement_interne' || result.category === 'Virement interne';
      
      // Check if revenue
      const isRevenue = parseFloat(tx.amount) > 0;
      
      // Determine if recurring (never for revenues or internal transfers)
      const isRecurring = (isInternalTransfer || isRevenue) ? false : (result.isRecurring === true);
      
      return {
        transactionId: tx.id,
        type: isInternalTransfer ? 'virement_interne' : (['commune', 'individuelle', 'abonnement', 'virement_interne'].includes(result.type)
          ? result.type
          : 'commune'),
        category: isInternalTransfer ? 'Virement interne' : (result.category || 'Autre'),
        confidence: Math.min(100, Math.max(0, parseInt(result.confidence) || 50)),
        reasoning: result.reasoning || '',
        isRecurring: isRecurring
      };
    });
    
  } catch (error) {
    console.error('Batch classification failed:', error.message);
    
    // Fallback: try individual classification
    console.log('Falling back to individual classification...');
    const results = [];
    
    for (const tx of transactions) {
      try {
        const result = await classifyTransaction(tx, learningContext, userInfo);
        results.push({
          transactionId: tx.id,
          ...result
        });
      } catch (individualError) {
        // Default if even individual fails
        results.push({
          transactionId: tx.id,
          type: 'individuelle',
          category: 'Autre',
          confidence: 0,
          reasoning: 'Classification échouée',
          isRecurring: false
        });
      }
    }
    
    return results;
  }
};

/**
 * Check if Mistral API is available
 */
const checkAPIHealth = async () => {
  const apiKey = getApiKey();
  const model = getModel();
  
  if (!apiKey || apiKey === 'votre_cle_mistral_gratuite') {
    return { 
      available: false, 
      error: 'API key not configured' 
    };
  }

  try {
    // Simple test call
    const response = await fetchWithTimeout(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      })
    }, 5000);

    return { 
      available: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    return { 
      available: false, 
      error: error.message 
    };
  }
};

module.exports = {
  classifyTransaction,
  classifyTransactionsBatch,
  checkAPIHealth,
  callMistralAPI
};
