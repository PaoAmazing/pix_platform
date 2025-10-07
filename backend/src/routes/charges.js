// backend/src/routes/charges.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const mercadopago = require('mercadopago');
const authenticateToken = require('../middleware/auth');

mercadopago.configure({
  access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
});

// Helper para gerar um orderId único (simplificado para preview)
const generateOrderId = () => `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// POST /api/charges - Criar uma nova cobrança PIX
router.post('/', authenticateToken, async (req, res) => {
  const { amount, description, orderId: clientOrderId, expireInMinutes = 30 } = req.body; // expireInMinutes opcional

  if (!amount || !description) {
    return res.status(400).json({ message: 'Valor e descrição são obrigatórios.' });
  }

  const orderId = clientOrderId || generateOrderId();
  const externalReference = orderId; // Usaremos o orderId como referência externa

  try {
    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description,
      payment_method_id: 'pix',
      external_reference: externalReference, // Importante para conciliação
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL, // Sua URL de webhook
      date_of_expiration: new Date(Date.now() + expireInMinutes * 60 * 1000).toISOString(),
      // Payer opcional para QR dinâmico, mas pode ser adicionado
      // payer: {
      //   email: "test_payer@example.com", // Adicione o email do pagador se tiver
      //   first_name: "Test",
      //   last_name: "User",
      //   identification: {
      //     type: "CPF",
      //     number: "11111111111"
      //   }
      // }
    };

    const payment = await mercadopago.payments.create(paymentData);

    const pix_data = payment.response.point_of_interaction.transaction_data;
    const qr_code_base64 = pix_data.qr_code_base64;
    const qr_code = pix_data.qr_code; // Isso é o "copia e cola"
    const txid = pix_data.transaction_id; // ID interno do Mercado Pago para a transação
    const e2e_id = pix_data.financial_institution_id; // Este pode ser o e2eId, dependendo da doc MP

    const result = await db.query(
      `INSERT INTO charges (order_id, txid, e2e_id, status, amount, description, qr_url, copia_e_cola, expiration_at, provider_raw)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [orderId, txid, e2e_id, 'aguardando', amount, description, `data:image/png;base64,${qr_code_base64}`, qr_code, paymentData.date_of_expiration, payment.response]
    );

    res.status(201).json({
      id: result.rows[0].id,
      status: result.rows[0].status,
      qrUrl: `data:image/png;base64,${qr_code_base64}`,
      copiaECola: qr_code,
      txid: txid,
      expirationAt: result.rows[0].expiration_at,
      orderId: result.rows[0].order_id,
      amount: result.rows[0].amount,
      description: result.rows[0].description
    });

  } catch (error) {
    console.error('Erro ao criar cobrança PIX:', JSON.stringify(error, null, 2));
    res.status(500).json({ message: 'Erro ao criar cobrança PIX', error: error.message });
  }
});

// GET /api/charges/:id - Obter detalhes de uma cobrança
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM charges WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cobrança não encontrada.' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar cobrança:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// GET /api/charges - Listar cobranças
router.get('/', authenticateToken, async (req, res) => {
  const { status, from, to, q } = req.query;
  let query = 'SELECT * FROM charges WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND status = $${paramIndex++}`;
    params.push(status);
  }
  if (from) {
    query += ` AND created_at >= $${paramIndex++}`;
    params.push(new Date(from));
  }
  if (to) {
    query += ` AND created_at <= $${paramIndex++}`;
    params.push(new Date(to));
  }
  if (q) {
    query += ` AND (description ILIKE $${paramIndex} OR order_id ILIKE $${paramIndex})`;
    params.push(`%${q}%`);
  }

  query += ' ORDER BY created_at DESC';

  try {
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar cobranças:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

module.exports = router;
