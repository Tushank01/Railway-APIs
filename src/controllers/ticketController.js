const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const TOTAL_CONFIRMED = 63;
const TOTAL_LOWER_BERTHS = 21;
const TOTAL_MIDDLE_BERTHS = 21;
const TOTAL_UPPER_BERTHS = 21;

const TOTAL_RAC_BERTHS = 9; // 9 RAC berths, 2 tickets each
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

async function findAvailableBerth(client) {
  // Check Lower berth availability
  const lowerCount = await getBerthCount(client, 'Confirmed', 'Lower');
  if (lowerCount < TOTAL_LOWER_BERTHS) return 'Lower';

  // Check Middle berth availability
  const middleCount = await getBerthCount(client, 'Confirmed', 'Middle');
  if (middleCount < TOTAL_MIDDLE_BERTHS) return 'Middle';

  // Check Upper berth availability
  const upperCount = await getBerthCount(client, 'Confirmed', 'Upper');
  if (upperCount < TOTAL_UPPER_BERTHS) return 'Upper';

  // No confirmed berth available
  return null;
}

async function allocateConfirmedBerth(client, age, gender, hasChildUnder5, berthPreference) {
  // Priority 1: Age >= 60, try Lower berth first
  if (age >= 60) {
    const lowerCount = await getBerthCount(client, 'Confirmed', 'Lower');
    if (lowerCount < TOTAL_LOWER_BERTHS) return 'Lower';
  }

  // Priority 2: Female with child under 5, try Lower berth
  if (gender.toLowerCase() === 'female' && hasChildUnder5) {
    const lowerCount = await getBerthCount(client, 'Confirmed', 'Lower');
    if (lowerCount < TOTAL_LOWER_BERTHS) return 'Lower';
  }

  // Priority 3: Try berthPreference if given and available
  if (berthPreference) {
    const count = await getBerthCount(client, 'Confirmed', berthPreference);
    let limit;
    switch (berthPreference) {
      case 'Lower':
        limit = TOTAL_LOWER_BERTHS;
        break;
      case 'Middle':
        limit = TOTAL_MIDDLE_BERTHS;
        break;
      case 'Upper':
        limit = TOTAL_UPPER_BERTHS;
        break;
      default:
        limit = 0;
    }
    if (count < limit) return berthPreference;
  }

  // Priority 4: Allocate any available berth in order Lower, Middle, Upper
  const available = await findAvailableBerth(client);
  if (available) return available;

  // No berth available (shouldn't happen if confirmedCount < TOTAL_CONFIRMED)
  return null;
}

exports.bookTicket = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { name, age, gender, berthPreference, hasChildUnder5 } = req.body;

    // Lock passengers table for exclusive mode to prevent race conditions
    await client.query(`LOCK TABLE passengers IN EXCLUSIVE MODE`);

    // Get counts of each status
    const confirmedResult = await client.query(`SELECT COUNT(*) FROM passengers WHERE status = 'Confirmed'`);
    const confirmedCount = parseInt(confirmedResult.rows[0].count);

    const racResult = await client.query(`SELECT COUNT(*) FROM passengers WHERE status = 'RAC'`);
    const racCount = parseInt(racResult.rows[0].count);

    const waitingResult = await client.query(`SELECT COUNT(*) FROM passengers WHERE status = 'Waiting'`);
    const waitingCount = parseInt(waitingResult.rows[0].count);

    let status, allocatedBerth = null;

    if (age < 5) {
      // Children under 5 do not get berth but get 'No Berth' status
      status = 'No Berth';
      allocatedBerth = null;
    } else if (confirmedCount < TOTAL_CONFIRMED) {
      status = 'Confirmed';
      allocatedBerth = await allocateConfirmedBerth(client, age, gender, hasChildUnder5, berthPreference);

      if (!allocatedBerth) {
        // Fallback (should not occur if confirmedCount < TOTAL_CONFIRMED)
        status = 'Waiting';
        allocatedBerth = null;
      }

    } else if (racCount < TOTAL_RAC) {
      status = 'RAC';
      allocatedBerth = 'Side-Lower'; // RAC berth is side lower

    } else if (waitingCount < TOTAL_WAITING) {
      status = 'Waiting';
      allocatedBerth = null;

    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No tickets available' });
    }

    const pnr = uuidv4().split('-')[0];

    const insertQuery = `
      INSERT INTO passengers (name, age, gender, has_child_under_5, berth_preference, allotted_berth, status, pnr, booking_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *
    `;

    const values = [name, age, gender, !!hasChildUnder5, berthPreference || null, allocatedBerth, status, pnr];

    const inserted = await client.query(insertQuery, values);

    await client.query('COMMIT');

    return res.status(201).json(inserted.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.cancelTicket = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const ticketId = req.params.ticketId;
    const ticketResult = await client.query('SELECT * FROM passengers WHERE id = $1', [ticketId]);

    if (ticketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = ticketResult.rows[0];
    const status = ticket.status;

    // Delete cancelled ticket
    await client.query('DELETE FROM passengers WHERE id = $1', [ticketId]);

    // Promotion logic if cancelled ticket was Confirmed
    if (status === 'Confirmed') {
      // Promote next RAC passenger (by booking_time) to Confirmed
      const nextRACResult = await client.query("SELECT * FROM passengers WHERE status = 'RAC' ORDER BY booking_time LIMIT 1");

      if (nextRACResult.rows.length > 0) {
        const racPassenger = nextRACResult.rows[0];

        // Allocate confirmed berth properly for promoted RAC passenger
        const allocatedBerth = await allocateConfirmedBerth(client, racPassenger.age, racPassenger.gender, racPassenger.has_child_under_5, racPassenger.berth_preference);

        await client.query(
          "UPDATE passengers SET status = 'Confirmed', allotted_berth = $1 WHERE id = $2",
          [allocatedBerth, racPassenger.id]
        );

        // Promote next Waiting passenger (if any) to RAC
        const nextWaitingResult = await client.query("SELECT * FROM passengers WHERE status = 'Waiting' ORDER BY booking_time LIMIT 1");

        if (nextWaitingResult.rows.length > 0) {
          const waitingPassenger = nextWaitingResult.rows[0];
          await client.query(
            "UPDATE passengers SET status = 'RAC', allotted_berth = 'Side-Lower' WHERE id = $1",
            [waitingPassenger.id]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.json({ message: 'Ticket cancelled and promotion applied if applicable' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

exports.getBookedTickets = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM passengers 
      WHERE status IN ('Confirmed', 'RAC', 'Waiting', 'No Berth')
      ORDER BY booking_time
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAvailableTickets = async (req, res) => {
  try {
    const confirmedResult = await db.query("SELECT COUNT(*) FROM passengers WHERE status = 'Confirmed'");
    const racResult = await db.query("SELECT COUNT(*) FROM passengers WHERE status = 'RAC'");
    const waitingResult = await db.query("SELECT COUNT(*) FROM passengers WHERE status = 'Waiting'");

    res.json({
      confirmedAvailable: TOTAL_CONFIRMED - parseInt(confirmedResult.rows[0].count),
      racAvailable: TOTAL_RAC - parseInt(racResult.rows[0].count),
      waitingListAvailable: TOTAL_WAITING - parseInt(waitingResult.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
