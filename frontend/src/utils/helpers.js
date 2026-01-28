export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

export const formatDate = (dateString) => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(dateString));
};

export const getCategoryColor = (category) => {
  const colors = {
    'Courses': 'bg-green-100 text-green-800',
    'Restaurant': 'bg-orange-100 text-orange-800',
    'Transport': 'bg-blue-100 text-blue-800',
    'Abonnement': 'bg-purple-100 text-purple-800',
    'Santé': 'bg-red-100 text-red-800',
    'Loisirs': 'bg-pink-100 text-pink-800',
    'Logement': 'bg-indigo-100 text-indigo-800',
    'Transfert Entrant': 'bg-teal-100 text-teal-800',
    'Transfert Sortant': 'bg-gray-100 text-gray-800',
    'default': 'bg-gray-100 text-gray-800'
  };
  return colors[category] || colors.default;
};

export const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const validatePassword = (password) => {
  // Min 8 chars, 1 uppercase, 1 lowercase, 1 number
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password);
};
