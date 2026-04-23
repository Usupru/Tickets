import dotenv from "dotenv";
import { pool } from "../src/db.js";

dotenv.config();

const run = async () => {
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users'
            AND column_name = 'full_name'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'users'
            AND column_name = 'username'
        ) THEN
          EXECUTE 'ALTER TABLE users RENAME COLUMN full_name TO username';
        END IF;
      END $$;

      TRUNCATE TABLE users RESTART IDENTITY CASCADE;
    `);

    console.log("Users table cleared.");
  } catch (error) {
    console.error("Could not reset users table:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
