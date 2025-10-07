// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const jwt = require('jsonwebtoken');
// Usar bcrypt para senhas em produção! Para este preview, vamos simplificar.
const bcrypt = require('bcryptjs'); // Apenas para simular, não usado para hash aqui.

// Rota de registro (para testes, sem hash de senha por enquanto)
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nome, email e senha são obrigatórios.' });
  }

  try {
    // Para um preview, vamos armazenar a senha em texto plano (NÃO FAZER EM PRODUÇÃO!)
    // Em produção: const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, password, role || 'operator']
    );
    res.status(201).json({ message: 'Usuário registrado com sucesso', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Duplicate email
      return res.status(409).json({ message: 'Email já registrado.' });
    }
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// Rota de Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Credenciais inválidas.' });
    }

    // Para o preview, apenas comparamos a senha em texto plano (NÃO FAZER EM PRODUÇÃO!)
    // Em produção: const passwordMatch = await bcrypt.compare(password, user.password);
    const passwordMatch = (password === user.password); // Comparação simples para preview

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Credenciais inválidas.' });
    }

    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token expira em 1 hora
    );

    res.json({ accessToken });

  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

module.exports = router;
