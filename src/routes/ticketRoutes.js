const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');

router.post('/book', ticketController.bookTicket);
router.post('/cancel/:ticketId', ticketController.cancelTicket);
router.get('/booked', ticketController.getBookedTickets);
router.get('/available', ticketController.getAvailableTickets);

module.exports = router;
