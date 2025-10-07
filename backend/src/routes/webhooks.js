// backend/src/routes/webhooks.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');

// Rota para receber webhooks do Mercado Pago
router.post('/mercadopago', async (req, res) => {
  const { type, data } = req.body;

  console.log('Webhook Mercado Pago recebido:', JSON.stringify(req.body, null, 2));

  // Persistir o webhook bruto para auditoria e processamento assíncrono
  try {
    await db.query(
      'INSERT INTO webhooks (provider, event_type, http_headers, payload) VALUES ($1, $2, $3, $4)',
      ['Mercado Pago', type, req.headers, req.body]
    );

    // Responde rapidamente ao MP para evitar retentativas desnecessárias
    res.sendStatus(200);

    // Processamento do webhook (poderia ser em uma fila/worker)
    if (type === 'payment' && data && data.id) {
      const paymentId = data.id;
      // Consultar a API do MP para obter detalhes completos do pagamento (boa prática)
      const mercadopago = require('mercadopago'); // Importar aqui para evitar circular dependency
      mercadopago.configure({
        access_token: process.env.MERCADOPAGO_ACCESS_TOKEN,
      });

      const paymentDetails = await mercadopago.payments.get(paymentId);
      const paymentStatus = paymentDetails.response.status;
      const externalReference = paymentDetails.response.external_reference; // Nosso order_id

      console.log(`Detalhes do pagamento ${paymentId}: Status ${paymentStatus}, External Ref: ${externalReference}`);

      if (paymentStatus === 'approved' || paymentStatus === 'authorized') {
        await db.query(
          `UPDATE charges SET status = 'pago', paid_at = NOW(), e2e_id = $1, txid = $2, payer_info = $3, provider_raw = $4 WHERE order_id = $5`,
          [
            paymentDetails.response.point_of_interaction?.transaction_data?.financial_institution_id, // e2e_id
            paymentDetails.response.id, // txid (ID do pagamento no MP)
            paymentDetails.response.payer,
            paymentDetails.response,
            externalReference
          ]
        );
        console.log(`Cobrança com order_id ${externalReference} atualizada para 'pago'.`);
      } else if (paymentStatus === 'cancelled' || paymentStatus === 'rejected') {
        await db.query(
          `UPDATE charges SET status = 'cancelado', provider_raw = $1 WHERE order_id = $2`,
          [paymentDetails.response, externalReference]
        );
        console.log(`Cobrança com order_id ${externalReference} atualizada para 'cancelado'.`);
      }
    }

  } catch (error) {
    console.error('Erro ao processar webhook do Mercado Pago:', error);
    // Em um sistema real, você registraria essa falha e tentaria novamente.
    // Por enquanto, apenas logamos.
  }
});

module.exports = router;
