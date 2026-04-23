const grid = document.querySelector("[data-admin-grid]");
const countBadge = document.querySelector("[data-admin-count]");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatDate = (value) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const formatPrice = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const renderEvents = (events) => {
  if (!grid) {
    return;
  }

  countBadge.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;

  if (!events.length) {
    grid.innerHTML = '<div class="admin-empty">No events available.</div>';
    return;
  }

  grid.innerHTML = "";
  events.forEach((event) => {
    const card = document.createElement("article");
    card.className = "admin-card";
    const editHref = `/admin/edit/${encodeURIComponent(event.id)}`;
    card.innerHTML = `
      <div class="admin-card__head">
        <span class="admin-chip">ID ${escapeHtml(event.id)}</span>
        <span class="admin-chip admin-chip--soft">${escapeHtml(event.city)}</span>
      </div>
      <h4>${escapeHtml(event.title)}</h4>
      <p>${escapeHtml(event.description ?? "")}</p>
      <dl class="admin-meta">
        <div>
          <dt>Price</dt>
          <dd>${formatPrice(event.price ?? 0)}</dd>
        </div>
        <div>
          <dt>Capacity</dt>
          <dd>${escapeHtml(String(event.capacity ?? 0))}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>${formatDate(event.date)}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>${escapeHtml(event.location)}</dd>
        </div>
        <div>
          <dt>Remaining seats</dt>
          <dd>${escapeHtml(String(event.remaining_seats ?? 0))}</dd>
        </div>
      </dl>
      <div class="admin-card__actions" aria-label="Event actions">
        <a class="button button-ghost admin-card__action" href="${editHref}">Edit</a>
        <form action="/admin/delete" method="POST">
          <input type="hidden" name="id" value="${escapeHtml(event.id)}">
          <button class="button button-danger admin-card__action" type="submit">
            Delete
          </button>
        </form>
      </div>
    `;
    grid.appendChild(card);
  });
};

const loadEvents = async () => {
  if (!grid) {
    return;
  }

  grid.innerHTML = '<div class="admin-empty">Loading events...</div>';

  try {
    const response = await fetch("/api/admin/events");
    const events = await response.json();

    if (!response.ok || !Array.isArray(events)) {
      throw new Error("Invalid events payload.");
    }

    renderEvents(events);
  } catch (error) {
    grid.innerHTML = '<div class="admin-empty">Could not load events.</div>';
  }
};

loadEvents();
