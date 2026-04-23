<h1>🎫 Tickets Events</h1>

Tickets Events is a full-stack event ticketing system built with Node.js, Express, PostgreSQL, server-side HTML rendering, and QR-based ticket validation.

<h2>✨ Features</h2>

<ul>
  <li>🎟️ Event catalog with tickets purchase flow</li>
  <li>👤 Session-based authentication</li>
  <li>🧑‍💼 Admin area for event management</li>
  <li>🛂 Staff ticket scanner with QR validation</li>
  <li>🗃️ PostgreSQL persistence layer</li>
  <li>🔐 Server-side authorization by role</li>
  <li>📦 Dockerized database setup</li>
  <li>🧾 Order history and ticket generation</li>
</ul>

<h2>🧱 Tech Stack</h2>

<ul>
  <li>Node.js</li>
  <li>Express</li>
  <li>PostgreSQL</li>
  <li>express-session</li>
  <li>bcrypt</li>
  <li>qrcode</li>
  <li>html5-qrcode</li>
</ul>

<h2>📁 Project Structure</h2>

<ul>
  <li><code>server.js</code> - main application server and route definitions</li>
  <li><code>src/db.js</code> - PostgreSQL pool configuration</li>
  <li><code>src/errorPage.js</code> - reusable error page renderer</li>
  <li><code>public/</code> - HTML, CSS, and browser-side JavaScript</li>
  <li><code>sql/schema.sql</code> - database schema</li>
  <li><code>sql/seed.sql</code> - initial event seed data</li>
  <li><code>scripts/seed.js</code> - manual seed script</li>
  <li><code>scripts/reset-users.js</code> - utility script for resetting users</li>
  <li><code>docker-compose.yml</code> - local PostgreSQL container setup</li>
</ul>

<h2>🚀 Installation</h2>

<h3>1. Prerequisites</h3>

Make sure you have the following installed:

<ul>
  <li>Node.js 18+</li>
  <li>npm</li>
  <li>Docker Desktop or a local PostgreSQL instance</li>
</ul>

<h3>2. Clone the repository</h3>

```bash
git clone https://github.com/Usupru/Tickets.git
cd Tickets-Events
```

<h3>3. Install dependencies</h3>

```bash
npm install
```

<h3>4. Configure environment variables</h3>

Copy <code>.env.example</code> into <code>.env</code> and adjust the values if needed.

```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=tickets_db
SESSION_SECRET=replace-me-with-a-long-random-string
DEFAULT_ADMIN=true
DEFAULT_STAFF=true
```

<h3>5. Start PostgreSQL</h3>

Option A - using Docker:

```bash
docker compose up -d
```

This will create the database container and initialize it with:

<ul>
  <li><code>sql/schema.sql</code></li>
  <li><code>sql/seed.sql</code></li>
</ul>

Option B - using your own PostgreSQL server:

<ul>
  <li>Create a database named <code>tickets_db</code></li>
  <li>Run <code>sql/schema.sql</code> manually</li>
  <li>Optionally run <code>sql/seed.sql</code> to load demo events</li>
</ul>

<h3>6. Start the app</h3>

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

<h2>⚙️ Usage</h2>

<h3>Public flow</h3>

<ul>
  <li>Open the home page and browse the available events</li>
  <li>Register or log in</li>
  <li>Select an event</li>
  <li>Reserve tickets</li>
  <li>Review your orders and generated QR tickets</li>
</ul>

<h3>Admin flow</h3>

If the logged-in user has the <code>admin</code> role, they can:

<ul>
  <li>Open the admin dashboard</li>
  <li>Create new events</li>
  <li>Edit existing events</li>
  <li>Delete events and their related orders/tickets</li>
</ul>

<h3>Staff flow</h3>

If the logged-in user has the <code>staff</code> role, they can:

<ul>
  <li>Open the staff view for an event</li>
  <li>Scan QR codes from the browser camera</li>
  <li>Validate tickets against the database</li>
  <li>Prevent duplicate check-ins</li>
</ul>

<h2>🧠 Application Flow</h2>

<h3>1. Server bootstrap</h3>

The app starts in <code>server.js</code>:

<ul>
  <li>Loads environment variables with <code>dotenv</code></li>
  <li>Creates the Express app</li>
  <li>Configures body parsing and sessions</li>
  <li>Serves static files from <code>public/</code></li>
  <li>Exposes the QR library from <code>node_modules/html5-qrcode</code></li>
  <li>Initializes the schema and default users</li>
  <li>Starts listening on <code>PORT</code></li>
</ul>

<h3>2. Database connection</h3>

<code>src/db.js</code> creates the PostgreSQL pool using the variables from <code>.env</code>.

That means the project is portable: anyone cloning it can point it to their own database without touching the source code.

<h3>3. Authentication and sessions</h3>

The login flow works like this:

<ul>
  <li>The user submits email/username and password</li>
  <li>The server checks the database</li>
  <li><code>bcrypt</code> validates the password hash</li>
  <li>The server stores a compact user object inside <code>req.session.user</code></li>
</ul>

From that point on, protected routes use the session to decide whether the user can access them.

<h3>4. Roles</h3>

The app uses three main roles:

<ul>
  <li><code>user</code> - regular customer</li>
  <li><code>staff</code> - can scan tickets</li>
  <li><code>admin</code> - can manage events</li>
</ul>

Role checks happen on the server before sensitive actions are allowed.

<h3>5. Events</h3>

Event data is loaded from PostgreSQL through the <code>/api/events</code> endpoint and rendered into the frontend.

Important event routes:

<ul>
  <li><code>GET /events/:id</code> - public event detail page</li>
  <li><code>GET /admin/edit/:id</code> - admin edit page</li>
  <li><code>GET /events/staff/:id</code> - staff scanner view</li>
</ul>

<h3>6. Ticket purchase flow</h3>

When a user reserves tickets:

<ul>
  <li>The server locks the selected event row with <code>FOR UPDATE</code></li>
  <li>It checks seat availability</li>
  <li>It creates an order</li>
  <li>It generates one unique ticket code per ticket</li>
  <li>It stores the QR payload in the <code>tickets</code> table</li>
  <li>It decrements the remaining seats</li>
</ul>

This logic is wrapped in a database transaction, so the purchase either completes fully or rolls back cleanly.

<h3>7. QR validation</h3>

The staff scanner works in two parts:

<ul>
  <li><code>public/scanner.js</code> opens the camera and reads QR codes in the browser</li>
  <li><code>POST /staff/events/:id/scan</code> validates the scanned payload on the server</li>
</ul>

The server then verifies:

<ul>
  <li>The ticket exists</li>
  <li>The ticket belongs to the selected event</li>
  <li>The ticket was not already checked in</li>
  <li>The QR payload matches the stored ticket data</li>
</ul>

If everything is valid, the ticket is marked as used in the database.

<h3>8. Static frontend</h3>

Most pages live in <code>public/</code> and are served directly by Express.

The frontend is intentionally simple:

<ul>
  <li>HTML templates for pages</li>
  <li>CSS in <code>styles.css</code></li>
  <li>Small browser scripts for dynamic behavior</li>
</ul>

<h2>🗄 Database Notes</h2>

<ul>
  <li><code>users</code> stores authentication and role data</li>
  <li><code>events</code> stores catalog entries and seat counts</li>
  <li><code>orders</code> stores purchases</li>
  <li><code>tickets</code> stores individual ticket QR codes and validation state</li>
</ul>

<h3>Default users</h3>

If enabled through <code>DEFAULT_ADMIN</code> and <code>DEFAULT_STAFF</code>, the app creates:

<ul>
  <li><code>admin@test.com</code> / <code>admin</code></li>
  <li><code>staff@test.com</code> / <code>staff</code></li>
</ul>

These are convenient for local testing only. Change them before sharing a real environment.

<h2>🧪 Useful Scripts</h2>

```bash
npm start
```

Start the server in production-like mode.

```bash
npm run dev
```

Same as <code>npm start</code> in this project.

```bash
npm run seed
```

Reinsert the demo events into the database.

```bash
node scripts/reset-users.js
```

Clear the users table and reset it for local testing.

<h2>📌 Notes</h2>

<ul>
  <li>This project is meant to be cloned and run locally, not deployed as a hosted SaaS</li>
  <li>The QR scanner needs browser camera access</li>
  <li>If you host it on a real server, camera scanning will usually require HTTPS</li>
  <li>The repository already includes <code>.env.example</code> so others can configure it quickly</li>
  <li><code>ensureSchema()</code> is intentionally empty in this version, so the schema is currently expected to come from Docker initialization or manual SQL execution</li>
</ul>
