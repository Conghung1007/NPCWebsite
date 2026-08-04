/**
 * One-shot: create commerce tables if missing (avoids interactive drizzle-kit rename prompts).
 * Run: npx tsx scripts/ensureCommerceTables.ts
 */
import "dotenv/config";
import { pool } from "../db";

const sql = `
CREATE TABLE IF NOT EXISTS courses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  level text NOT NULL DEFAULT 'N5',
  description text,
  cover_image_url text,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS class_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id varchar NOT NULL,
  title text NOT NULL,
  start_date timestamp,
  end_date timestamp,
  schedule_text text,
  location_note text,
  price_vnd integer NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 10,
  enrolled_count integer NOT NULL DEFAULT 0,
  reserved_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token text,
  user_id varchar,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id varchar NOT NULL,
  class_session_id varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_class_idx ON cart_items (cart_id, class_session_id);

CREATE TABLE IF NOT EXISTS orders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  payos_order_code integer NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  note text,
  user_id varchar,
  total_vnd integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_link_id text,
  checkout_url text,
  paid_at timestamp,
  expires_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL,
  class_session_id varchar NOT NULL,
  title text NOT NULL,
  schedule_text text,
  price_vnd integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id varchar NOT NULL,
  order_id varchar NOT NULL,
  user_id varchar,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_class_phone_idx ON enrollments (class_session_id, phone);
`;

async function main() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Commerce tables ensured.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
