import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true); // true while checking stored token

  // On app load — check if there's a stored token and validate it
  useEffect(() => {
    const token = localStorage.getItem('riq_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(res => {
          setUser(res.data.user);
          setCompany(res.data.company);
        })
        .catch(() => {
          // Token invalid or expired — clear it
          localStorage.removeItem('riq_token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData, companyData) => {
    localStorage.setItem('riq_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
    setCompany(companyData);
  };

  const logout = useCallback(() => {
    localStorage.removeItem('riq_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setCompany(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setCompany(res.data.company);
    } catch (err) {
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, company, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
