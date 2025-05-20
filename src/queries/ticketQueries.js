const db = require('../db');

const TOTAL_CONFIRMED = 63;
const TOTAL_LOWER_BERTHS = 21;
const TOTAL_MIDDLE_BERTHS = 21;
const TOTAL_UPPER_BERTHS = 21;

const TOTAL_RAC_BERTHS = 9;
const TOTAL_RAC = TOTAL_RAC_BERTHS * 2; // 18 RAC tickets
const TOTAL_WAITING = 10;

const BERTH_TYPES = ['Lower', 'Middle', 'Upper'];

async function getBerthCount(client, status, berthType) {
  const result = await client.query(
    `SELECT COUNT(*) FROM passengers WHERE status = $1 AND allotted_berth = $2`,
    [status, berthType]
  );
  return parseInt(result.rows[0].count);
}

async function getStatusCount(client, status) {
  const result = await client.query(
    `SELECT COUNT(*) FROM passengers WHERE status = $1`,
    [status]
  );
  return parseInt(result.rows[0].count);
}

async function insertPassenger(client, passenger) {
  const { name, age, gender, hasChildUnder5, berthPreference, allocatedBerth, status, pnr } = passenger;

  const insertQuery = `
    INSERT INTO passengers 
      (name, age, gender, has_child_under_5, berth_preference, allotted_berth, status, pnr, booking_time)
    VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *
  `;

  const values = [
    name, age, gender, !!hasChildUnder5, berthPreference || null,
    allocatedBerth, status, pnr
  ];

  const result = await client.query(insertQuery, values);
  return result.rows[0];
}

async function getTicketById(client, ticketId) {
  const result = await client.query('SELECT * FROM passengers WHERE id = $1', [ticketId]);
  return result.rows[0];
}

async function deleteTicketById(client, ticketId) {
  await client.query('DELETE FROM passengers WHERE id = $1', [ticketId]);
}

async function getNextPassengerByStatus(client, status) {
  const result = await client.query(
    "SELECT * FROM passengers WHERE status = $1 ORDER BY booking_time LIMIT 1",
    [status]
  );
  return result.rows[0];
}

async function updatePassengerStatusAndBerth(client, id, status, berth) {
  await client.query(
    "UPDATE passengers SET status = $1, allotted_berth = $2 WHERE id = $3",
    [status, berth, id]
  );
}

async function getAllBookedTickets() {
  return db.query(`
    SELECT * FROM passengers 
    WHERE status IN ('Confirmed', 'RAC', 'Waiting', 'No Berth')
    ORDER BY booking_time
  `);
}

async function getAvailableTicketsCount() {
  const confirmed = await db.query("SELECT COUNT(*) FROM passengers WHERE status = 'Confirmed'");
  const rac = await db.query("SELECT COUNT(*) FROM passengers WHERE status = 'RAC'");
  const waiting = await db.query("SELECT COUNT(*) FROM passengers WHERE status = 'Waiting'");

  return {
    confirmedAvailable: TOTAL_CONFIRMED - parseInt(confirmed.rows[0].count),
    racAvailable: TOTAL_RAC - parseInt(rac.rows[0].count),
    waitingListAvailable: TOTAL_WAITING - parseInt(waiting.rows[0].count),
  };
}

module.exports = {
  TOTAL_CONFIRMED,
  TOTAL_LOWER_BERTHS,
  TOTAL_MIDDLE_BERTHS,
  TOTAL_UPPER_BERTHS,
  TOTAL_RAC,
  TOTAL_WAITING,
  BERTH_TYPES,
  getBerthCount,
  getStatusCount,
  insertPassenger,
  getTicketById,
  deleteTicketById,
  getNextPassengerByStatus,
  updatePassengerStatusAndBerth,
  getAllBookedTickets,
  getAvailableTicketsCount,
};
