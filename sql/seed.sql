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
