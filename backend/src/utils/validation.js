/**
 * Validate that a parameter is a valid positive integer ID
 * Prevents SQL injection and parameter tampering
 */
const isValidId = (id) => {
  if (id === undefined || id === null) return false;
  const parsed = parseInt(id, 10);
  return !isNaN(parsed) && parsed > 0 && String(parsed) === String(id);
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPassword = (password) => {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
};

const validateRegister = (email, password, firstName, lastName) => {
  const errors = [];
  if (!email || !isValidEmail(email)) errors.push('Valid email is required');
  if (!password || !isValidPassword(password)) errors.push('Password must be at least 8 characters with 1 uppercase and 1 number');
  if (!firstName || firstName.trim().length === 0) errors.push('First name is required');
  if (!lastName || lastName.trim().length === 0) errors.push('Last name is required');
  return errors;
};

const validateLogin = (email, password) => {
  const errors = [];
  if (!email || !isValidEmail(email)) errors.push('Valid email is required');
  if (!password || password.length === 0) errors.push('Password is required');
  return errors;
};

module.exports = { isValidId, isValidEmail, isValidPassword, validateRegister, validateLogin };
