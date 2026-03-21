// api.js
const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// Endpoint para mensaje de WhatsApp
app.post('/api/whatsapp-message', (req, res) => {
  const { tipo, nombre, productos } = req.body;
  let mensaje = '';
  if (tipo === 'soporte') {
    mensaje = 'Hola, quiero más información sobre los productos.';
  } else if (tipo === 'pedido') {
    mensaje = `¡Hola! Quiero completar mi pedido:\nNombre: ${nombre || ''}\nProductos: ${(productos || []).join(', ')}`;
  } else {
    mensaje = 'Hola, ¿en qué puedo ayudarte?';
  }
  res.json({ mensaje });
});

app.listen(3001, () => console.log('API escuchando en puerto 3001'));
