//We import required modules

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { pool, ensureSchema } from "./src/db.js";
import { renderErrorPage } from "./src/errorPage.js";
import bcrypt from "bcrypt";
import session from "express-session";
import crypto from "crypto";
import QRCode from "qrcode";

//Setting up .env file

dotenv.config();

//Setting up express session and server

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT
const sessionSecret = process.env.SESSION_SECRET || "tickets-events-dev-secret";

//Trusting proxy

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Building session configuration

app.use(
  session({
    name: "tickets.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false, //Avoid saving unneccesary guest sessions
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7, //Seven days
    },
  })
);



app.use(express.static(path.join(__dirname, "public"), { index: false }));
app.use(
  "/vendor",
  express.static(path.join(__dirname, "node_modules", "html5-qrcode"))
); //Exposes html5-qrcode library, served under /vendor

const sendPage = (res, fileName) => {
  res.sendFile(path.join(__dirname, "public", fileName));
};

const wantsHtml = (req) => (req.headers.accept || "").includes("text/html");


//In case no default admin or staff account is found, a new one gets generated 
// (can be changed under .env, DEFAULT_ADMIN, DEFAULT_STAFF)

const generateAdminUser = async () => {
  if (process.env.DEFAULT_ADMIN === "false") {
    return false;
  }

  try {
    const username = "admin";
    const email = "admin@test.com";
    const password = "admin";
    const role = "admin"

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return false;
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [username, email, password_hash, role]
    );

    return true;
  } catch (error) {
    console.error("Failed to generate default admin user:", error);
    throw error;
  }
};

const generateStaffUser = async () => {
  if (process.env.DEFAULT_STAFF === "false") {
    return false;
  }

  try {
    const username = "staff";
    const email = "staff@test.com";
    const password = "staff";
    const role = "staff"

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return false;
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [username, email, password_hash, role]
    );

    return true;
  } catch (error) {
    console.error("Failed to generate default staff user:", error);
    throw error;
  }
};

//Escaping content before injecting it in html enviroments

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatEventDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));

const formatEventPrice = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const formatDateTimeLocalValue = (value) => {
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
};

//Defines user session

const buildSessionUser = (user) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
});

const generateTicketCode = () => `TKT-${crypto.randomBytes(16).toString("base64url")}`;

const generateUniqueTicketCode = async (client) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ticketCode = generateTicketCode();
    const result = await client.query(
      "SELECT 1 FROM tickets WHERE ticket_code = $1 LIMIT 1",
      [ticketCode]
    );

    if (result.rowCount === 0) {
      return ticketCode;
    }
  }
  // --> Throws error in case no original QR code could be generated in 10 attemps
  throw new Error("Could not generate a unique ticket code.");
};

const getUserRole = async (user) => {
  const result = await pool.query("SELECT role FROM users WHERE id = $1", [
    user.id,
  ]);

  return result.rows[0]?.role ?? user.role;
};

const getEventById = async (eventId) => {
  const result = await pool.query(
    `
      SELECT
        id,
        title,
        description,
        location,
        city,
        date,
        price,
        capacity,
        remaining_seats
      FROM events
      WHERE id = $1
    `,
    [eventId]
  );

  return result.rows[0] ?? null;
};

const renderEventPage = (event) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(event.title)} | Tickets Events</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell event-page">
      <header class="topbar">
        <div class="topbar-left">
          <a class="button button-ghost page-home-link" href="/">Home</a>
          <div class="brand">
            <div class="brand-mark">TE</div>
            <div>
              <p class="eyebrow">Event details</p>
              <h1>${escapeHtml(event.title)}</h1>
            </div>
          </div>
        </div>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/">Back to catalog</a>
        </div>
      </header>

      <main class="event-layout">
        <section class="event-detail-panel">
          <div class="event-summary">
            <h2>${escapeHtml(event.title)}</h2>
            <p class="event-summary__description">${escapeHtml(event.description ?? "")}</p>
          </div>

          <div class="readonly-grid">
            <div class="readonly-field">
              <span class="readonly-label">Price</span>
              <span class="readonly-value">${escapeHtml(formatEventPrice(event.price ?? 0))}</span>
            </div>
            <div class="readonly-field">
              <span class="readonly-label">Capacity</span>
              <span class="readonly-value">${escapeHtml(String(event.capacity ?? 0))}</span>
            </div>
            <div class="readonly-field">
              <span class="readonly-label">Location</span>
              <span class="readonly-value">${escapeHtml(event.location)}</span>
            </div>
            <div class="readonly-field">
              <span class="readonly-label">City</span>
              <span class="readonly-value">${escapeHtml(event.city)}</span>
            </div>
            <div class="readonly-field readonly-field--full">
              <span class="readonly-label">Date</span>
              <span class="readonly-value">${escapeHtml(formatEventDate(event.date))}</span>
            </div>
          </div>

          <div class="event-cta-form">
            <a class="button button-primary event-cta-button" href="/purchase.html?eventId=${encodeURIComponent(event.id)}">
              Buy tickets
            </a>
          </div>

          <div class="event-page__actions">
            <a class="button button-primary" href="/">Back to home</a>
          </div>
        </section>
      </main>
    </div>
  </body>
</html>
`;

const renderStaffEventPage = (event) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(event.title)} | Tickets Events</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell event-page">
      <header class="topbar">
        <div class="topbar-left">
          <a class="button button-ghost page-home-link" href="/">Home</a>
          <div class="brand">
            <div class="brand-mark">TE</div>
            <div>
              <p class="eyebrow">Event details</p>
              <h1>${escapeHtml(event.title)}</h1>
            </div>
          </div>
        </div>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/">Back to catalog</a>
        </div>
      </header>

      <main class="event-layout">
        <section class="event-detail-panel">
          <div class="event-summary">
            <h2>${escapeHtml(event.title)}</h2>
            <p class="event-summary__description">${escapeHtml(event.description ?? "")}</p>
          </div>

          <div class="readonly-grid">
            <div class="readonly-field">
              <span class="readonly-label">Price</span>
              <span class="readonly-value">${escapeHtml(formatEventPrice(event.price ?? 0))}</span>
            </div>
            <div class="readonly-field">
              <span class="readonly-label">Capacity</span>
              <span class="readonly-value">${escapeHtml(String(event.capacity ?? 0))}</span>
            </div>
            <div class="readonly-field">
              <span class="readonly-label">Location</span>
              <span class="readonly-value">${escapeHtml(event.location)}</span>
            </div>
            <div class="readonly-field">
              <span class="readonly-label">City</span>
              <span class="readonly-value">${escapeHtml(event.city)}</span>
            </div>
            <div class="readonly-field readonly-field--full">
              <span class="readonly-label">Date</span>
              <span class="readonly-value">${escapeHtml(formatEventDate(event.date))}</span>
            </div>
          </div>

          <div class="event-cta-form">
            <a class="button button-primary event-cta-button" href="/events/staff/${encodeURIComponent(event.id)}">
              Scan tickets
            </a>
          </div>

          <div class="event-page__actions">
            <a class="button button-primary" href="/">Back to home</a>
          </div>
        </section>
      </main>
    </div>
  </body>
</html>
`;

const renderStaffScanEventPage = (event) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Scan ${escapeHtml(event.title)} | Tickets Events</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="scanner-page">
      <section class="scanner-card" aria-label="Ticket scanner" data-event-id="${escapeHtml(event.id)}">
        <div class="scanner-card__copy">
          <p class="eyebrow">Ticket validation</p>
          <h1>${escapeHtml(event.title)}</h1>
          <p class="scanner-card__description">
            ${escapeHtml(event.description ?? "Scan ticket QR codes for this event.")}
          </p>
          <div class="scanner-card__meta">
            <div>
              <span class="scanner-card__label">Location</span>
              <strong>${escapeHtml(event.location)}</strong>
            </div>
            <div>
              <span class="scanner-card__label">City</span>
              <strong>${escapeHtml(event.city)}</strong>
            </div>
            <div>
              <span class="scanner-card__label">Date</span>
              <strong>${escapeHtml(formatEventDate(event.date))}</strong>
            </div>
          </div>
        </div>
        <div id="qr-reader" class="scanner-reader" aria-label="QR scanner camera view"></div>
        <p id="scan-result" class="scan-result" aria-live="polite">
          Ready to scan.
        </p>
      </section>
    </main>
    <script src="/vendor/html5-qrcode.min.js"></script>
    <script src="/scanner.js" defer></script>
  </body>
</html>
`;

//Renders event edit page

const renderAdminEditPage = (event) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Edit ${escapeHtml(event.title)} | Tickets Events</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell admin-page admin-edit-page">
      <header class="topbar">
        <div class="topbar-left">
          <a class="button button-ghost page-home-link" href="/admin">Admin</a>
          <div class="brand">
            <div class="brand-mark">TE</div>
            <div>
              <p class="eyebrow">Administration</p>
              <h1>Edit event</h1>
            </div>
          </div>
        </div>
        <div class="topbar-actions">
          <a class="button button-ghost" href="/admin">Back to admin</a>
          <a class="button button-primary" href="/events/${encodeURIComponent(event.id)}">View event</a>
        </div>
      </header>

      <main class="admin-layout admin-layout--single">
        <section class="hero-copy hero-copy--compact">
          <p class="eyebrow">Edit event</p>
          <h2>Review the event data before editing.</h2>
          <p class="lead">
            This is a static edit mockup with the event data already filled in.
            You can change the fields locally, but there is no save action yet.
          </p>
        </section>

        <section class="admin-panel">
          <form class="admin-form" action="/admin/edit" method="post">
            <input type="hidden" name="id" value="${escapeHtml(event.id)}" />
            <label>
              Title
              <input type="text" name="title" value="${escapeHtml(event.title)}" />
            </label>
            <label>
              Description
              <textarea rows="4" name="description">${escapeHtml(event.description ?? "")}</textarea>
            </label>
            <div class="admin-form__row">
              <label>
                Price
                <input type="number" name="price" min="0" step="0.01" value="${escapeHtml(String(event.price ?? 0))}" />
              </label>
              <label>
                Capacity
                <input type="number" name="capacity" min="1" step="1" value="${escapeHtml(String(event.capacity ?? 0))}" />
              </label>
            </div>
            <div class="admin-form__row">
              <label>
                Location
                <input type="text" name="location" value="${escapeHtml(event.location)}" />
              </label>
              <label>
                City
                <input type="text" name="city" value="${escapeHtml(event.city)}" />
              </label>
            </div>
            <div class="admin-form__row">
              <label>
                Date
                <input type="datetime-local" name="date" value="${escapeHtml(formatDateTimeLocalValue(event.date))}" />
              </label>
            </div>
            <div class="readonly-field readonly-field--full">
              <span class="readonly-label">Remaining seats</span>
              <strong class="readonly-value">${escapeHtml(String(event.remaining_seats ?? 0))}</strong>
            </div>
          <div class="admin-edit__actions">
            <button class="button button-primary" type="submit">Save changes</button>
            <span class="admin-form__note">Changes will be saved to the database.</span>
          </div>
          </form>
        </section>
      </main>
    </div>
  </body>
</html>
`;

//Renders each tickets contained in the tickets array

const renderTicketCard = ({ ticketNumber, event, orderId, ticketCode }) => `
          <article class="ticket-card">
            <div class="ticket-card__header">
              <div>
                <p class="ticket-card__eyebrow">Ticket ${escapeHtml(String(ticketNumber))}</p>
                <h3>${escapeHtml(event.title)}</h3>
              </div>
              <span class="ticket-card__badge">Reserved</span>
            </div>
            <div class="ticket-card__qr">
              <img src="/tickets/${encodeURIComponent(ticketCode)}/qr.svg" alt="QR for ticket ${escapeHtml(String(ticketNumber))}" />
            </div>
            <dl class="ticket-card__meta">
              <div>
                <dt>Order</dt>
                <dd>#${escapeHtml(String(orderId))}</dd>
              </div>
            </dl>
          </article>
`;

//Renders order card used in /orders

const renderOrderCard = ({ order }) => {
  return `
          <article class="order-card">
            <div class="order-card__header">
              <div>
                <p class="eyebrow">Order #${escapeHtml(String(order.order_id))}</p>
                <h4>${escapeHtml(order.event_title)}</h4>
              </div>
  
            </div>

            <p class="order-card__description">
              ${escapeHtml(order.event_description ?? "")}
            </p>

            <dl class="order-meta">
              <div>
                <dt>Tickets</dt>
                <dd>${escapeHtml(String(order.quantity ?? 0))}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>${escapeHtml(formatEventDate(order.event_date))}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>${escapeHtml(formatEventPrice(order.total_amount))}</dd>
              </div>
              <div class="order-meta__full">
                <dt>Location</dt>
                <dd>${escapeHtml(`${order.event_location}, ${order.event_city}`)}</dd>
              </div>
            </dl>

            <div class="order-card__actions">
              <form action="/orders/${escapeHtml(String(order.order_id))}" method="get">
                <button class="button button-primary" type="submit">See Order</button>
              </form>
            </div>
          </article>
  `;
};

const renderOrders = ({ orders }) => `
                    <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Tickets | Tickets Events</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div class="page-shell orders-page">
      <header class="topbar">
        <div class="topbar-left">
          <a class="button button-ghost page-home-link" href="/">Home</a>
          <div class="brand">
            <div class="brand-mark">TE</div>
            <div>
              <p class="eyebrow">Orders</p>
              <h1>My Tickets</h1>
            </div>
          </div>
        </div>
        <div class="topbar-actions">
          <a class="button button-secondary" href="/">Back to events</a>
        </div>
      </header>

      <main class="orders-layout">
        <section class="orders-panel" aria-label="Orders list">
          <div class="orders-panel__head">
            <div>
              <p class="eyebrow">${escapeHtml(String(orders.length))} order${orders.length === 1 ? "" : "s"}</p>
              <h3>Reserved tickets</h3>
            </div>
          </div>

          ${
            orders.length > 0
              ? orders.map((order) => renderOrderCard({ order })).join("")
              : `
                <article class="order-empty">
                  <p class="eyebrow">No orders yet</p>
                  <h4>You have not reserved any tickets.</h4>
                  <p class="order-card__description">
                    Browse the event catalog and reserve your first tickets from the home page.
                  </p>
                  <div class="order-card__actions">
                    <a class="button button-primary" href="/">Browse events</a>
                  </div>
                </article>
              `
          }
        </section>
      </main>
    </div>
  </body>
</html>

`;

const renderPurchaseSuccessPage = ({ event, tickets, orderId, totalAmount }) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Purchase confirmed | Tickets Events</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main class="success-page">
      <section class="success-card success-card--purchase">
        <p class="eyebrow">Reservation confirmed</p>
        <h1>Your tickets are reserved.</h1>
        <p>
          ${escapeHtml(String(tickets.length))} ticket${tickets.length === 1 ? "" : "s"} for <strong>${escapeHtml(event.title)}</strong>
          were registered successfully.
        </p>
        <div class="purchase-success__summary">
          <div>
            <span class="readonly-label">Order</span>
            <strong class="readonly-value">#${escapeHtml(String(orderId))}</strong>
          </div>
          <div>
            <span class="readonly-label">Total</span>
            <strong class="readonly-value">${escapeHtml(formatEventPrice(totalAmount))}</strong>
          </div>
        </div>
        <div class="purchase-success__tickets">
          <p class="readonly-label">Reserved tickets</p>
          <div class="ticket-grid">
            ${tickets.map((ticket) =>
                renderTicketCard({
                  ticketNumber: ticket.ticketNumber,
                  event,
                  orderId,
                  ticketCode: ticket.ticketCode,
                })
              )
              .join("")}
          </div>
        </div>
        <div class="success-card__action">
          <a class="button button-primary" href="/">Back to home</a>
        </div>
      </section>
    </main>
  </body>
</html>
`;

// Modifies existing renderPurchaseSuccessPage() to serve as detailed order details

const renderOrderDetailPage = ({ event, tickets, orderId, totalAmount }) =>
  renderPurchaseSuccessPage({
    event,
    tickets,
    orderId,
    totalAmount,
  }).replace(
    "<title>Purchase confirmed | Tickets Events</title>",
    "<title>Order details | Tickets Events</title>"
  ).replace(
    "<p class=\"eyebrow\">Reservation confirmed</p>",
    "<p class=\"eyebrow\">Order details</p>"
  ).replace(
    "<h1>Your tickets are reserved.</h1>",
    "<h1>Your order is ready.</h1>"
  ).replace(
    "were registered successfully.",
    "is ready to review."
  ).replace(
    "<a class=\"button button-primary\" href=\"/\">Back to home</a>",
    "<a class=\"button button-primary\" href=\"/orders\">Back to orders</a>"
  );

  // --> To avoid redundancy, we can chain multiple .replace() together since they return a string

const requireAdminPage = async (req, res, pageName) => {
  const user = req.session.user;

  if (!user) {
    return res.redirect("/login");
  }

  const role = await getUserRole(user);
  if (role !== "admin") {
    return res.status(403).send("Permission denied");
  }

  return sendPage(res, pageName);
};

app.get("/tickets/:ticketCode/qr.svg", async (req, res) => {
  try {
    const { ticketCode } = req.params;
    const user = req.session?.user;

    if (!user) {
      return res.redirect("/login");
    }

    if (!/^[A-Za-z0-9_-]+$/.test(ticketCode)) {
      return res.status(400).send("Invalid ticket code.");
    } // --> To avoid useless SQL Queries, 
    // if the ticket code doesn't match its format, it's unvalid

    const result = await pool.query(
      `
      SELECT qr_payload, order_id
      FROM tickets
      WHERE ticket_code = $1
      LIMIT 1
      `,
      [ticketCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("QR not found.");
    }

    const ticket = result.rows[0];
    const qrPayload = ticket.qr_payload;
    const orderId = ticket.order_id;

    const orderResult = await pool.query(
      `
      SELECT user_id
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).send("Order not found.");
    }

    if (orderResult.rows[0].user_id !== user.id) {
      return res.status(403).send("Permission denied");
    }

    const qrSvg = await QRCode.toString(qrPayload, {
      type: "svg",
      errorCorrectionLevel: "M", // --> M = "Medium", balance between 
      // reliablity and QR size
    });

    return res.type("image/svg+xml").send(qrSvg);
  } catch (error) {
    console.error("Could not generate QR:", error);
    return res.status(500).send("Could not generate QR.");
  }
});

const buildEventCode = () => {
  const now = new Date();
  const pad = (n, len) => String(n).padStart(len, "0");

  const datePart =
    `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;
  const timePart =
    `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}${pad(now.getMilliseconds(), 3)}`;

  return `${datePart}${timePart}`;
};

app.get("/", (req, res) => {
  if (req.session.user) {
    return sendPage(res, "index.html");
  }

  if (req.hostname.startsWith("login.")) {
    return sendPage(res, "login.html");
  }

  if (req.hostname.startsWith("register.")) {
    return sendPage(res, "register.html");
  }

  return sendPage(res, "index.html");
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }

  return sendPage(res, "login.html");
});

app.get("/register", (req, res) => {
  if (req.session.user) {
    return res.redirect("/");
  }

  return sendPage(res, "register.html");
});

app.get("/orders", async (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.redirect("/login");
  }

  try {
    const result = await pool.query(
      `
        SELECT
          o.id AS order_id,
          o.quantity,
          o.total_amount,
          o.status,
          e.title AS event_title,
          e.description AS event_description,
          e.date AS event_date,
          e.location AS event_location,
          e.city AS event_city,
          COALESCE(
            array_agg(t.ticket_code ORDER BY t.id) FILTER (WHERE t.ticket_code IS NOT NULL),
            ARRAY[]::text[]
          ) AS ticket_codes
        FROM orders o
        JOIN events e
          ON e.id = o.event_id
        LEFT JOIN tickets t
          ON t.order_id = o.id
        WHERE o.user_id = $1
        GROUP BY o.id, e.id
        ORDER BY o.id DESC
      `,
      [user.id]
    ); // --> Returns orders linked to the requested event and user ownership

    return res.type("html").send(renderOrders({ orders: result.rows }));
  } catch (error) {
    console.error("Could not load orders:", error);
    return res.status(500).send("Internal server error.");
  }
});

app.get("/orders/:orderId", async (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.redirect("/login");
  }

  try {
    const orderResult = await pool.query(
      `
        SELECT
          o.id AS order_id,
          o.quantity,
          o.total_amount,
          o.status,
          e.id AS event_id,
          e.title,
          e.description,
          e.date,
          e.location,
          e.city
        FROM orders o
        JOIN events e
          ON e.id = o.event_id
        WHERE o.id = $1
          AND o.user_id = $2
        LIMIT 1
      `,
      [req.params.orderId, user.id]
    ); // --> Returns 1 order by ID and user

    if (orderResult.rows.length === 0) {
      return res.status(404).send("Order not found.");
    }

    const order = orderResult.rows[0];

    const ticketsResult = await pool.query(
      `
        SELECT ticket_code
        FROM tickets
        WHERE order_id = $1
        ORDER BY id ASC
      `,
      [order.order_id]
    ); // --> Returns all tickets linked to the order

    const tickets = ticketsResult.rows.map((ticket, index) => ({
      ticketNumber: index + 1,
      ticketCode: ticket.ticket_code,
    }));

    return res.type("html").send(
      renderOrderDetailPage({
        event: {
          title: order.title,
          description: order.description,
          date: order.date,
          location: order.location,
          city: order.city,
        },
        tickets,
        orderId: order.order_id,
        totalAmount: order.total_amount,
      })
    );
  } catch (error) {
    console.error("Could not load order details:", error);
    return res.status(500).send("Internal server error.");
  }
});

app.get("/admin", async (req, res) => {
  try {
    return await requireAdminPage(req, res, "admin.html");
  } catch (error) {
    console.error("Could not load admin page:", error);
    return res.status(500).send("Internal server error.");
  }
});

app.get("/admin/create", async (req, res) => {
  try {
    return await requireAdminPage(req, res, "admin-create.html");
  } catch (error) {
    console.error("Could not load admin create page:", error);
    return res.status(500).send("Internal server error.");
  }
});

app.get("/admin/edit/:id", async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.redirect("/login");
    }

    const role = await getUserRole(user);
    if (role !== "admin") {
      return res.status(403).send("Permission denied");
    }

    const event = await getEventById(req.params.id);
    if (!event) {
      return res
        .status(404)
        .send(
          renderErrorPage({
            statusCode: 404,
            title: "Event not found",
            message: "The event you requested does not exist.",
            actionLabel: "Back to admin",
            actionHref: "/admin",
          })
        );
    }

    return res.type("html").send(renderAdminEditPage(event));
  } catch (error) {
    console.error("Could not load admin edit page:", error);
    return res.status(500).send("Internal server error.");
  }
});

// Event page renderization depends on the user's role, if the user is
// a staff member they will receive an alternative button for scanning
// tickets of the event selected

app.get("/events/:id", async (req, res) => {

  const user = req.session.user

  try {
    const event = await getEventById(req.params.id);

    if (!event) {
      return res
        .status(404)
        .send(
          renderErrorPage({
            statusCode: 404,
            title: "Event not found",
            message: "The event you requested does not exist.",
            actionLabel: "Back to home",
            actionHref: "/",
          })
        );
    }

    if (!user) {
    return res.type("html").send(renderEventPage(event));
    } // --> Even if the user is not logged in, we want to render the event anyways

    if (user.role=="staff"){
      return res.type("html").send(renderStaffEventPage(event));
      // --> Renders staff event page for scanning QR
    }else{
      return res.type("html").send(renderEventPage(event));
    }
  } catch (error) {
    console.error("Could not load event page:", error);
    return res.status(500).send("Internal server er ror.");
  }
});

app.get("/events/staff/:id", async (req, res) => {

  const user = req.session.user

  try {
    const event = await getEventById(req.params.id);

    if (!event) {
      return res
        .status(404)
        .send(
          renderErrorPage({
            statusCode: 404,
            title: "Event not found",
            message: "The event you requested does not exist.",
            actionLabel: "Back to home",
            actionHref: "/",
          })
        );
    }

    if (!user) {
    return res.redirect('/login');
    }

    if (user.role=="staff"){
      return res.type("html").send(renderStaffScanEventPage(event));
      // We return the scan page only to staff members in the first place
    }else{
      return res.status(403).json({ error: "Permission denied." });
    }
  } catch (error) {
    console.error("Could not load event page:", error);
    return res.status(500).send("Internal server error.");
  }
});

app.post("/staff/events/:id/scan", async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    if (user.role !== "staff") {
      return res.status(403).json({ success: false, message: "Permission denied." });
    }

    const event = await getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: "Event not found." });
    }

    const rawQr = String(req.body?.qr ?? "").trim();
    if (!rawQr) {
      return res.status(400).json({ success: false, message: "Missing QR payload." });
    }

    let decodedPayload = null;
    try {
      decodedPayload = JSON.parse(rawQr);
    } catch {
      decodedPayload = null;
    }

    const ticketCode =
      typeof decodedPayload === "object" && decodedPayload !== null
        ? String(decodedPayload.ticketCode ?? "").trim()
        : rawQr;

    // We make sure the server can handle the decoded payload in both JSON
    // and plain text formats (since scanner.js returns decodedText as a string)

    if (!/^[A-Za-z0-9_-]+$/.test(ticketCode)) {
      return res.status(400).json({ success: false, message: "Invalid ticket code." });
    } // --> Making sure the ticket has the right format to avoid unnecesary SQL Queries
    

    const ticketResult = await pool.query(
      `
        SELECT
          t.id,
          t.ticket_code,
          t.checked_in_at,
          t.qr_payload,
          o.event_id
        FROM tickets t
        JOIN orders o ON o.id = t.order_id
        WHERE t.ticket_code = $1
        LIMIT 1
      `,
      [ticketCode]
    );

    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Ticket not found." });
    }

    const ticket = ticketResult.rows[0];

    if (ticket.event_id !== event.id) {
      return res
        .status(400)
        .json({ success: false, message: "That ticket does not belong to this event." });
    }

    if (ticket.checked_in_at) {
      return res.json({
        success: false,
        message: `Ticket already validated at ${formatEventDate(ticket.checked_in_at)}.`,
      });
    }

    // Same code but for JSON formatted QR

    if (decodedPayload && typeof decodedPayload === "object") {
      const payloadEventId = String(decodedPayload.eventId ?? "");
      const payloadTicketCode = String(decodedPayload.ticketCode ?? "");

      if (payloadEventId && payloadEventId !== event.id) {
        return res
          .status(400)
          .json({ success: false, message: "The scanned QR does not match this event." });
      }

      if (payloadTicketCode && payloadTicketCode !== ticketCode) {
        return res
          .status(400)
          .json({ success: false, message: "The scanned QR does not match this ticket." });
      }
    }

    // Updating DB to prevent mutliple uses of tickets

    await pool.query(
      `
        UPDATE tickets
           SET checked_in_at = NOW()
         WHERE id = $1
      `,
      [ticket.id]
    );

    return res.json({
      success: true,
      message: `Ticket validated successfully.`,
    });
  } catch (error) {
    console.error("Could not validate ticket scan:", error);
    return res.status(500).json({ success: false, message: "Could not validate ticket." });
  }
});

app.get("/error", (req, res) => {
  const statusCode = Number(req.query.statusCode || 500);
  const title = req.query.title || "Something went wrong";
  const message = req.query.message || "The server could not complete the request.";
  const details = req.query.details || "";
  const actionLabel = req.query.actionLabel || "Go home";
  const actionHref = req.query.actionHref || "/";

  res
    .status(Number.isNaN(statusCode) ? 500 : statusCode)
    .send(
      renderErrorPage({
        statusCode: Number.isNaN(statusCode) ? 500 : statusCode,
        title,
        message,
        details,
        actionLabel,
        actionHref,
      })
    );
});



app.get("/api/session", (req, res) => {
  res.json({
    authenticated: Boolean(req.session.user),
    user: req.session.user ?? null,
  });
});

app.get("/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS server_time");
    res.json({
      ok: true,
      database: "connected",
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      database: "disconnected",
      error: "Could not connect to PostgreSQL.",
    });
  }
});



app.get("/api/events", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        location,
        city,
        date,
        price,
        capacity,
        remaining_seats
      FROM events
      ORDER BY date ASC, id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Could not load events:", error);
    res.status(500).json({ error: "Could not load events." });
  }
});


app.get("/api/admin/events", async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    const role = await getUserRole(user);
    if (role !== "admin") {
      return res.status(403).json({ error: "Permission denied." });
    }

    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        location,
        city,
        date,
        price,
        capacity,
        remaining_seats
      FROM events
      ORDER BY date ASC, id ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Could not load admin events:", error);
    res.status(500).json({ error: "Could not load events." });
  }
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !email || !password) {
      return res.status(400).send("Missing fields.");
    }
    
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR username = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).send("That email or username is already registered.");
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)`,
      [username, email, password_hash]
    );

    sendPage(res, 'success.html')
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).send("Missing fields.");
    }

    const result = await pool.query(
      "SELECT id, username, email, role, password_hash FROM users WHERE email = $1 OR username = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).send("Invalid email or password.");
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).send("Invalid email or password.");
    }

    req.session.user = buildSessionUser({
      id: user.id,
      username: user.username,
      email,
      role: user.role ?? "user",
    });

    req.session.save((sessionError) => {
      if (sessionError) {
        console.error(sessionError);
        return res.status(500).send("Could not start the session.");
      }

      if (wantsHtml(req)) {
        return res.redirect("/");
      }

      return res.json({
        ok: true,
        user: req.session.user,
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(error);
      return res.status(500).send("Could not close the session.");
    }

    res.clearCookie("tickets.sid");

    if (wantsHtml(req)) {
      return res.redirect("/");
    }

    return res.json({ ok: true });
  });
});

app.post("/admin/create", async (req, res) => {
  const { title, description, location, city, date, price, capacity } = req.body;
  const id = buildEventCode();

  try {
    const user = req.session.user;

    if (!user) {
      return res.redirect("/login");
    }

    const result = await pool.query("SELECT role FROM users WHERE id = $1", [
      user.id,
    ]);

    const role = result.rows[0]?.role ?? user.role;
    if (role !== "admin") {
      return res.status(403).send("Permission denied");
    }

    const parsedPrice = Number(price);
    const parsedCapacity = Number(capacity);

    if (!title || !description || !location || !city || !date || price === undefined || capacity === undefined) {
      return res.status(400).send("Missing fields.");
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).send("Invalid price or capacity.");
    }

    await pool.query(
      `INSERT INTO events (id, title, description, location, city, date, price, capacity, remaining_seats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id, title, description, location, city, date, parsedPrice, parsedCapacity]
    );

    return sendPage(res, "event_success.html");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error.");
  }
});

app.post("/admin/edit", async (req, res) => {
  const { id, title, description, location, city, date, price, capacity } = req.body;

  try {
    const user = req.session.user;

    if (!user) {
      return res.redirect("/login");
    }

    const result = await pool.query("SELECT role FROM users WHERE id = $1", [
      user.id,
    ]);

    const role = result.rows[0]?.role ?? user.role;
    if (role !== "admin") {
      return res.status(403).send("Permission denied");
    }

    const parsedPrice = Number(price);
    const parsedCapacity = Number(capacity);

    if (!id || !title || !description || !location || !city || !date || price === undefined || capacity === undefined) {
      return res.status(400).send("Missing fields.");
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).send("Invalid price or capacity.");
    }

    const existingEvent = await getEventById(id);
    if (!existingEvent) {
      return res.status(404).send("Event not found.");
    }

    const soldSeats = Math.max(Number(existingEvent.capacity) - Number(existingEvent.remaining_seats), 0);
    const nextRemainingSeats = Math.max(parsedCapacity - soldSeats, 0);

    const updateResult = await pool.query(
      `UPDATE events
       SET title = $1,
       description = $2,
       location = $3,
       city = $4,
       date = $5,
       price = $6,
       capacity = $7,
       remaining_seats = $8
       WHERE id = $9`,
      [title, description, location, city, date, parsedPrice, parsedCapacity, nextRemainingSeats, id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).send("Event not found.");
    }

    return sendPage(res, "event_success_edit.html");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error.");
  }
});

app.post("/admin/delete", async (req, res) => {

  // We make sure to also delete all orders and tickets linked to the deleted
  // event

  const { id } = req.body;

  try {
    const user = req.session.user;

    if (!user) {
      return res.redirect("/login");
    }

    const result = await pool.query("SELECT role FROM users WHERE id = $1", [
      user.id,
    ]);

    const role = result.rows[0]?.role ?? user.role;
    if (role !== "admin") {
      return res.status(403).send("Permission denied");
    }

    const existingEvent = await getEventById(id);
    if (!existingEvent) {
      return res.status(404).send("Event not found.");
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          DELETE FROM tickets
          WHERE order_id IN (
            SELECT id
            FROM orders
            WHERE event_id = $1
          )
        `,
        [id]
      );

      await client.query(
        `
          DELETE FROM orders
          WHERE event_id = $1
        `,
        [id]
      );

      const deleteResult = await client.query(
        `
          DELETE FROM events
          WHERE id = $1
        `,
        [id]
      );

      if (deleteResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).send("Event not found.");
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return res.redirect("/admin");
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error.");
  }
});

app.post("/reserve", async (req, res) => {
  const eventId = req.body.eventId ?? req.body.id;
  const quantity = Number(req.body.quantity ?? 1);

  try {
    const user = req.session.user;

    if (!user) {
      return res.redirect("/login");
    }

    if (!eventId) {
      return res.status(400).send("Missing event.");
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
      return res.status(400).send("Quantity must be between 1 and 4.");
    }

    const client = await pool.connect();

    try {

      await client.query("BEGIN");

      const eventResult = await client.query(
        `
          SELECT id, title, price, remaining_seats
          FROM events
          WHERE id = $1
          FOR UPDATE
        `,
        [eventId]
      );

      const event = eventResult.rows[0];
      if (!event) {
        await client.query("ROLLBACK"); // Rolling back in case no event was found to avoid half-made changes to the DB
        return res.status(404).send("Event not found.");
      }

      const remainingSeats = Number(event.remaining_seats ?? 0);
      if (quantity > remainingSeats) {
        await client.query("ROLLBACK");
        return res.status(400).send("Not enough seats available.");
      }

      const totalAmount = Number(event.price ?? 0) * quantity;

      const orderResult = await client.query(
        `
          INSERT INTO orders (user_id, event_id, quantity, total_amount, status)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
        [user.id, event.id, quantity, totalAmount, "confirmed"]
      );

      const orderId = orderResult.rows[0].id;
      const tickets = [];

      for (let index = 0; index < quantity; index += 1) {
        // For each ticket bought, we generate one row in the ticket table, linking
        // each one to a single order
        const ticketCode = await generateUniqueTicketCode(client);
        tickets.push({
          ticketNumber: index + 1,
          ticketCode,
        });

        await client.query(
          `
            INSERT INTO tickets (order_id, ticket_code, price, qr_payload)
            VALUES ($1, $2, $3, $4)
          `,
          [
            orderId,
            ticketCode,
            event.price ?? 0,
            JSON.stringify({
              orderId,
              eventId: event.id,
              ticketCode,
            }),
          ]
        );

      }

      await client.query(
        `
          UPDATE events
             SET remaining_seats = remaining_seats - $2
           WHERE id = $1
        `,
        [event.id, quantity]
      );

      await client.query("COMMIT");

      return res
        .type("html")
        .send(
          renderPurchaseSuccessPage({
            event,
            tickets,
            orderId,
            totalAmount,
          })
        );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error.");
  }
});


app.use((req, res) => {
  res
    .status(404)
    .send(
      renderErrorPage({
        statusCode: 404,
        title: "Page not found",
        message: "The page you requested does not exist.",
        actionLabel: "Back to home",
      actionHref: "/",
      })
    );
});

try {
  await ensureSchema();
  await generateAdminUser();
  await generateStaffUser();
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
} catch (error) {
  console.error("Failed to initialize database schema:", error);
  process.exitCode = 1;
}
