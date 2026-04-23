CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(40) PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  location VARCHAR(160) NOT NULL,
  city VARCHAR(120) NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 0,
  remaining_seats INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id VARCHAR(40) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_code VARCHAR(80) NOT NULL UNIQUE,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  qr_payload TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO events (
  id,
  title,
  description,
  location,
  city,
  date,
  price,
  capacity,
  remaining_seats
)
VALUES
  (
    'EVT-001',
    'Electro Nights',
    'Night festival with DJs, visuals, and a main stage for electronic music.',
    'Central Arena',
    'Buenos Aires',
    '2026-07-18 22:00:00-03',
    45000,
    800,
    800
  ),
  (
    'EVT-002',
    'Rock Session Live',
    'Intimate concert with local bands, live sound, and a food court area.',
    'North Theater',
    'Cordoba',
    '2026-08-02 20:30:00-03',
    32000,
    500,
    500
  ),
  (
    'EVT-003',
    'Innovation Summit',
    'A meetup for professionals with talks, workshops, and networking.',
    'South Convention Center',
    'Rosario',
    '2026-09-14 09:00:00-03',
    18000,
    300,
    300
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  location = EXCLUDED.location,
  city = EXCLUDED.city,
  date = EXCLUDED.date,
  price = EXCLUDED.price,
  capacity = EXCLUDED.capacity,
  remaining_seats = EXCLUDED.remaining_seats;
