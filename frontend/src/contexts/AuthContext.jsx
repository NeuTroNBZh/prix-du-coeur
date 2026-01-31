import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [pending2FAToken, setPending2FAToken] = useState(null); // Token sécurisé pour 2FA

  // Charger le profil complet avec la photo et isInCouple
  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/api/auth/profile');
      setUser(prev => ({
        ...prev,
        ...response.data,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
        profilePictureUrl: response.data.profilePictureUrl,
        isInCouple: response.data.isInCouple, // Explicitly include for single user support
        isAdmin: response.data.isAdmin || false // Admin status
      }));
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  };

  useEffect(() => {
    if (token) {
      // Decode JWT to get user info (basic implementation)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.userId,
          email: payload.email,
          firstName: payload.firstName,
          lastName: payload.lastName,
          profilePictureUrl: null,
          isInCouple: undefined // Will be loaded from profile API
        });
        // Fetch full profile to get picture and isInCouple
        fetchUserProfile();
      } catch (e) {
        localStorage.removeItem('token');
        setToken(null);
      }
    }
    setLoading(false);
  }, [token]);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { token: newToken, user: userData, requires2FA, pendingToken, method, requiresEmailVerification } = response.data;
    
    if (requiresEmailVerification) {
      return { requiresEmailVerification: true, email };
    }
    
    if (requires2FA) {
      // Stocker le token sécurisé pour l'étape 2FA (plus sécurisé que userId)
      setPending2FAToken(pendingToken);
      return { requires2FA: true, method: method || 'totp' };
    }
    
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return { requires2FA: false };
  };

  const loginWith2FA = async (totpToken) => {
    if (!pending2FAToken) {
      throw new Error('No pending 2FA login');
    }
    const response = await authAPI.loginWith2FA(pending2FAToken, totpToken);
    const { token: newToken, user: userData } = response.data;
    
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    setPending2FAToken(null); // Reset
  };

  const register = async (data) => {
    const response = await authAPI.register(data);
    const { token: newToken, user: userData, requiresEmailVerification, email } = response.data;
    
    // Si vérification email requise, ne pas stocker de token
    if (requiresEmailVerification) {
      return { requiresEmailVerification: true, email };
    }
    
    // Ancien comportement (ne devrait plus arriver)
    if (newToken) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
    }
    
    return { requiresEmailVerification: false };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWith2FA, register, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
