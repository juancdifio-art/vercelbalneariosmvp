import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function useAuth(options = {}) {
  const { onLogoutCleanup } = options;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Limpiar localStorage antiguo y rehidratar auth desde sessionStorage al montar
  useEffect(() => {
    // Migrar de localStorage a sessionStorage si existe
    const oldToken = localStorage.getItem('authToken');
    const oldEmail = localStorage.getItem('authEmail');
    
    if (oldToken && oldEmail) {
      // Limpiar localStorage antiguo
      localStorage.removeItem('authToken');
      localStorage.removeItem('authEmail');
      console.log('Migrado de localStorage a sessionStorage. Por favor, vuelve a iniciar sesión.');
    }

    const token = sessionStorage.getItem('authToken');
    const storedEmail = sessionStorage.getItem('authEmail');

    if (token && storedEmail) {
      setIsAuthenticated(true);
      setAuthToken(token);
      setUserEmail(storedEmail);
      setEmail(storedEmail);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Completá email y contraseña.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        data = null;
      }

      if (!response.ok) {
        if (data && data.error === 'invalid_credentials') {
          setError('Credenciales inválidas.');
        } else if (data && data.error === 'missing_fields') {
          setError('Faltan datos.');
        } else {
          setError('Error al iniciar sesión.');
        }
        return;
      }

      if (data && data.token) {
        sessionStorage.setItem('authToken', data.token);
        setAuthToken(data.token);
      }

      const finalEmail = (data && data.user && data.user.email) || email;
      sessionStorage.setItem('authEmail', finalEmail);
      setUserEmail(finalEmail);
      setIsAuthenticated(true);
      setSuccess('Login correcto.');
    } catch (err) {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('authEmail');
    setIsAuthenticated(false);
    setAuthToken('');
    setUserEmail('');
    setPassword('');
    setError('');
    setSuccess('');

    if (typeof onLogoutCleanup === 'function') {
      onLogoutCleanup();
    }
  };

  return {
    isAuthenticated,
    setIsAuthenticated,
    authToken,
    setAuthToken,
    userEmail,
    setUserEmail,
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    setError,
    success,
    setSuccess,
    handleSubmit,
    handleLogout
  };
}

export default useAuth;
