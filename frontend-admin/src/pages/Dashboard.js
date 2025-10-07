// frontend-admin/src/pages/Dashboard.js
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dashboard Admin</h1>
        {user && (
          <div style={styles.userInfo}>
            <span>Olá, {user.name || user.email}! ({user.role})</span>
            <button onClick={logout} style={styles.logoutButton}>Sair</button>
          </div>
        )}
      </header>
      <nav style={styles.nav}>
        <ul style={styles.navList}>
          <li style={styles.navItem}>
            <Link to="/charges" style={styles.navLink}>Minhas Cobranças PIX</Link>
          </li>
          <li style={styles.nav
