# Railway Ticket Reservation API

This project is a Node.js backend API for Railway Ticket Reservation using PostgreSQL and Docker.

## Features

- Fully automated PostgreSQL database setup with schema initialization.
- Environment variables configuration for easy customization.
- Docker Compose setup to build and run the app and database together.
- Nodemon for auto-restart during development.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed and running.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

---

## Setup & Run Locally

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd railway-ticket-reservation-api
   ```

2. **Create `.env` file**

   Copy `.env.example` and update environment variables if needed:

   ```bash
   cp .env.example .env
   ```

   By default, the `.env` file contains:

   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgrespassword
   POSTGRES_DB=railwaydb
   POSTGRES_PORT=5432

   APP_PORT=3000
   DB_HOST=postgres
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=postgrespassword
   DB_NAME=railwaydb
   ```

3. **Run Docker Compose**

   This will:

   - Build and start the PostgreSQL database container.
   - Run your `init.sql` file automatically on first launch to create the database schema.
   - Build and start the Node.js app container.

   ```bash
   docker-compose up --build
   ```

4. **Access the API**

   The backend server will run on [http://localhost:3000](http://localhost:3000) by default.

---

## Project Structure

- `docker-compose.yml` — defines PostgreSQL and Node.js app containers.
- `init.sql` — SQL script run automatically on PostgreSQL container initialization to setup tables and indexes.
- `.env.example` — example environment variables file.
- `src/` — Node.js source code.
- `package.json` — Node.js dependencies and scripts.

---

## Notes

- No manual database creation or migrations are needed; all handled automatically via Docker and the init script.
- Modify environment variables in `.env` to change database credentials or ports.
- Nodemon is enabled for live reload during development.

---

## Troubleshooting

- If you encounter connection issues, ensure Docker is running and ports are not blocked.
- If database schema does not update, try running:

  ```bash
  docker-compose down -v
  docker-compose up --build
  ```

---

## License

MIT License

---

Feel free to open issues or submit pull requests for improvements!
