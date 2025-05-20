-- Drop table if exists (for reinitialization)
DROP TABLE IF EXISTS passengers;

CREATE TABLE passengers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL CHECK (age >= 0),
    gender VARCHAR(10),
    has_child_under_5 BOOLEAN NOT NULL DEFAULT FALSE,
    berth_preference VARCHAR(20),
    allotted_berth VARCHAR(20),
    status VARCHAR(20) NOT NULL,
    pnr VARCHAR(20) UNIQUE NOT NULL,
    booking_time TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster queries by status or booking_time
CREATE INDEX idx_passengers_status ON passengers(status);
CREATE INDEX idx_passengers_booking_time ON passengers(booking_time);

