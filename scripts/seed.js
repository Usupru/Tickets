import dotenv from "dotenv";
import { pool } from "../src/db.js";

dotenv.config();

const events = [
  {
    id: "EVT-001",
    title: "Electro Nights",
    description: "Night festival with DJs, visuals, and a main stage for electronic music.",
    location: "Central Arena",
    city: "Buenos Aires",
    date: "2026-07-18 22:00:00-03",
    price: 45000,
    capacity: 800,
  },
  {
    id: "EVT-002",
    title: "Rock Session Live",
    description: "Intimate concert with local bands, live sound, and a food court area.",
    location: "North Theater",
    city: "Cordoba",
    date: "2026-08-02 20:30:00-03",
    price: 32000,
    capacity: 500,
  },
  {
    id: "EVT-003",
    title: "Innovation Summit",
    description: "A meetup for professionals with talks, workshops, and networking.",
    location: "South Convention Center",
    city: "Rosario",
    date: "2026-09-14 09:00:00-03",
    price: 18000,
    capacity: 300,
  },
];

const run = async () => {
  try {
    for (const event of events) {
      await pool.query(
        `
          INSERT INTO events (
            id, title, description, location, city, date,
            price, capacity, remaining_seats
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $8
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            location = EXCLUDED.location,
            city = EXCLUDED.city,
            date = EXCLUDED.date,
            price = EXCLUDED.price,
            capacity = EXCLUDED.capacity,
            remaining_seats = EXCLUDED.remaining_seats
        `,
        [
          event.id,
          event.title,
          event.description,
          event.location,
          event.city,
          event.date,
          event.price,
          event.capacity,
        ]
      );
    }

    console.log("Event seed completed.");
  } catch (error) {
    console.error("Error seeding events:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
