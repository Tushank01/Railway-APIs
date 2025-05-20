const { v4: uuidv4 } = require('uuid');
const ticketQueries = require('../queries/ticketQueries');

async function findAvailableBerth(client) {
  // Try lower
  let count = await ticketQueries.getBerthCount(client, 'Confirmed', 'Lower');
  if (count < ticketQueries.TOTAL_LOWER_BERTHS) return 'Lower';

  // Try middle
  count = await ticketQueries.getBerthCount(client, 'Confirmed', 'Middle');
  if (count < ticketQueries.TOTAL_MIDDLE_BERTHS) return 'Middle';

  // Try upper
  count = await ticketQueries.getBerthCount(client, 'Confirmed', 'Upper');
  if (count < ticketQueries.TOTAL_UPPER_BERTHS) return 'Upper';

  return null;
}

async function allocateConfirmedBerth(client, age, gender, hasChildUnder5, berthPreference) {
  // Priority 1: Senior
  if (age >= 60) {
    const lowerCount = await ticketQueries.getBerthCount(client, 'Confirmed', 'Lower');
    if (lowerCount < ticketQueries.TOTAL_LOWER_BERTHS) return 'Lower';
  }

  // Priority 2: Female with child under 5
  if (gender.toLowerCase() === 'female' && hasChildUnder5) {
    const lowerCount = await ticketQueries.getBerthCount(client, 'Confirmed', 'Lower');
    if (lowerCount < ticketQueries.TOTAL_LOWER_BERTHS) return 'Lower';
  }

  // Priority 3: User preference
  if (berthPreference && ticketQueries.BERTH_TYPES.includes(berthPreference)) {
    const count = await ticketQueries.getBerthCount(client, 'Confirmed', berthPreference);
    let limit = 0;
    switch (berthPreference) {
      case 'Lower': limit = ticketQueries.TOTAL_LOWER_BERTHS; break;
      case 'Middle': limit = ticketQueries.TOTAL_MIDDLE_BERTHS; break;
      case 'Upper': limit = ticketQueries.TOTAL_UPPER_BERTHS; break;
    }
    if (count < limit) return berthPreference;
  }

  // Priority 4: Any available berth
  const available = await findAvailableBerth(client);
  if (available) return available;

  return null;
}

async function bookTicket(client, passengerData) {
  const { name, age, gender, berthPreference, hasChildUnder5 } = passengerData;

  // Lock for race condition prevention
  await client.query(`LOCK TABLE passengers IN EXCLUSIVE MODE`);

  const confirmedCount = await ticketQueries.getStatusCount(client, 'Confirmed');
  const racCount = await ticketQueries.getStatusCount(client, 'RAC');
  const waitingCount = await ticketQueries.getStatusCount(client, 'Waiting');

  let status, allocatedBerth = null;

  if (age < 5) {
    status = 'No Berth';
    allocatedBerth = null;
  } else if (confirmedCount < ticketQueries.TOTAL_CONFIRMED) {
    status = 'Confirmed';
    allocatedBerth = await allocateConfirmedBerth(client, age, gender, hasChildUnder5, berthPreference);
    if (!allocatedBerth) {
      status = 'Waiting';
      allocatedBerth = null;
    }
  } else if (racCount < ticketQueries.TOTAL_RAC) {
    status = 'RAC';
    allocatedBerth = 'Side-Lower'; // RAC berth fixed
  } else if (waitingCount < ticketQueries.TOTAL_WAITING) {
    status = 'Waiting';
    allocatedBerth = null;
  } else {
    throw new Error('No tickets available');
  }

  const pnr = uuidv4().split('-')[0];

  const insertedPassenger = await ticketQueries.insertPassenger(client, {
    name,
    age,
    gender,
    hasChildUnder5,
    berthPreference,
    allocatedBerth,
    status,
    pnr,
  });

  return insertedPassenger;
}

async function cancelTicket(client, ticketId) {
  const ticket = await ticketQueries.getTicketById(client, ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  await ticketQueries.deleteTicketById(client, ticketId);

  if (ticket.status === 'Confirmed') {
    // Promote RAC passenger to Confirmed
    const racPassenger = await ticketQueries.getNextPassengerByStatus(client, 'RAC');
    if (racPassenger) {
      const allocatedBerth = await allocateConfirmedBerth(
        client,
        racPassenger.age,
        racPassenger.gender,
        racPassenger.has_child_under_5,
        racPassenger.berth_preference
      );

      await ticketQueries.updatePassengerStatusAndBerth(client, racPassenger.id, 'Confirmed', allocatedBerth);

      // Promote waiting passenger to RAC
      const waitingPassenger = await ticketQueries.getNextPassengerByStatus(client, 'Waiting');
      if (waitingPassenger) {
        await ticketQueries.updatePassengerStatusAndBerth(client, waitingPassenger.id, 'RAC', 'Side-Lower');
      }
    }
  }
}

async function getBookedTickets() {
  const result = await ticketQueries.getAllBookedTickets();
  return result.rows;
}

async function getAvailableTickets() {
  return ticketQueries.getAvailableTicketsCount();
}

module.exports = {
  bookTicket,
  cancelTicket,
  getBookedTickets,
  getAvailableTickets,
};
