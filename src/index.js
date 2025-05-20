const express = require('express');
const app = express();
const ticketRoutes = require('./routes/tickets');
app.use(express.json());
app.use('/api/v1/tickets', ticketRoutes);
app.listen(3000, () => console.log('Server running on port 3000'));