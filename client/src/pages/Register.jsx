import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Button, Input, Card } from '../components/UI';
import styles from './Auth.module.css';

export default function Register() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form, setForm]       = useState({ companyName: '', name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const handleChange = e => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.companyName)          e.companyName = 'Company name is required';
    if (!form.name)                 e.name        = 'Your name is required';
    if (!form.email)                e.email       = 'Email is required';
    if (!form.password)             e.password    = 'Password is required';
    if (form.password.length < 8)   e.password    = 'Password must be at least 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await api.post('/auth/register', form);
      login(res.data.token, res.data.user, res.data.company);
      toast.success('Account created! Welcome to ReportIQ.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
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
          <h2 className={styles.authTitle}>Create your account</h2>
          <p className={styles.authSub}>Start your 14-day free trial — no card required</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Company name"
              name="companyName"
              placeholder="PowerPlus Technologies Ltd"
              value={form.companyName}
              onChange={handleChange}
              error={errors.companyName}
              autoFocus
            />
            <Input
              label="Your name"
              name="name"
              placeholder="Bonheur Nshimiyimana"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
            />
            <Input
              label="Email address"
              type="email"
              name="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
            />
            <Input
              label="Phone (optional)"
              type="tel"
              name="phone"
              placeholder="+250 7XX XXX XXX"
              value={form.phone}
              onChange={handleChange}
            />
            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="At least 8 characters"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
            />
            <Button type="submit" loading={loading} className={styles.submitBtn}>
              Create Account
            </Button>
          </form>

          <p className={styles.authSwitch}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
