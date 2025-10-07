// backend/src/server.js
require('dotenv').config({ path: '../../.env' }); // Carrega .env da raiz do projeto
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Para permitir requisições do frontend
const authRoutes = require('./routes/auth');
const chargesRoutes = require('./routes/charges');
const webhooksRoutes = require('./routes/webhooks');
const authenticateToken = require('./middleware/auth'); // Importar aqui para usar em rotas protegidas

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Habilita o CORS para todas as origens (para preview)
app.use(bodyParser.json());

// Rotas de autenticação (não precisam de autenticação JWT para login/registro)
app.use('/api/auth', authRoutes);

// Rotas protegidas (exigem JWT)
app.use('/api/charges', chargesRoutes); // As rotas de charges usam authenticateToken internamente
// Para o painel, você terá mais rotas protegidas, como /api/users, /api/payouts, etc.

// Rotas de webhook (não precisam de autenticação JWT)
app.use('/api/webhooks', webhooksRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.send('Backend do PIX Mercado Pago está online!');
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
