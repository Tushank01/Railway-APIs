const express = require('express');
const router = express.Router();
const controller = require('../controllers/ticketController');
router.post('/book', controller.bookTicket);
router.post('/cancel/:ticketId', controller.cancelTicket);
router.get('/booked', controller.getBookedTickets);
router.get('/available', controller.getAvailableTickets);
module.exports = router;