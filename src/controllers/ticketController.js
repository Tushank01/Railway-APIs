const db = require('../db');
const ticketService = require('../services/ticketService');

exports.bookTicket = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const passengerData = req.body;
    const result = await ticketService.bookTicket(client, passengerData);

    await client.query('COMMIT');
    res.status(201).json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.cancelTicket = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const ticketId = req.params.ticketId;
    await ticketService.cancelTicket(client, ticketId);

    await client.query('COMMIT');
    res.json({ message: 'Ticket cancelled and promotion applied if applicable' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.getBookedTickets = async (req, res) => {
  try {
    const tickets = await ticketService.getBookedTickets();
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAvailableTickets = async (req, res) => {
  try {
    const available = await ticketService.getAvailableTickets();
    res.json(available);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
