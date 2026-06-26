import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Button, Input, Card } from '../components/UI';
import styles from './Auth.module.css';

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.email)    e.email    = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.token, res.data.user, res.data.company);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authBox}>
        <div className={styles.authLogo}>
          <span>⚡</span>
          <h1>ReportIQ</h1>
        </div>
        <Card className={styles.authCard}>
          <h2 className={styles.authTitle}>Welcome back</h2>
          <p className={styles.authSub}>Sign in to your account</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Email address"
              type="email"
              name="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              autoFocus
            />
            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
            />
            <Button type="submit" loading={loading} className={styles.submitBtn}>
              Sign In
            </Button>
          </form>

          <p className={styles.authSwitch}>
            Don't have an account? <Link to="/register">Register your company</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
