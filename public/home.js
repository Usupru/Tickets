const track = document.querySelector("[data-carousel-track]");
const dots = document.querySelector("[data-carousel-dots]");
const prevButton = document.querySelector("[data-carousel-prev]");
const nextButton = document.querySelector("[data-carousel-next]");
const sessionSlot = document.querySelector("[data-session-slot]");

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

const renderDots = (count) => {
  dots.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot";
    dot.setAttribute("aria-label", `Go to event ${index + 1}`);
    dot.addEventListener("click", () => {
      const card = track.children[index];
      card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
    dots.appendChild(dot);
  }
};

const updateActiveDot = () => {
  const cards = [...track.children];
  if (!cards.length) return;

  const activeIndex = cards.findIndex((card) => {
    const rect = card.getBoundingClientRect();
    const containerRect = track.parentElement.getBoundingClientRect();
    return rect.left >= containerRect.left - rect.width / 2 && rect.right <= containerRect.right + rect.width / 2;
  });

  const dotsList = [...dots.children];
  dotsList.forEach((dot, index) => {
    dot.classList.toggle("is-active", index === (activeIndex === -1 ? 0 : activeIndex));
  });
};

const loadEvents = async () => {
  track.innerHTML = '<div class="carousel-empty">Loading events...</div>';
  dots.innerHTML = "";

  try {
    const response = await fetch("/api/events");
    const events = await response.json();

    if (!response.ok || !Array.isArray(events)) {
      throw new Error("Invalid events payload.");
    }

    if (!events.length) {
      track.innerHTML = '<div class="carousel-empty">No events are loaded.</div>';
      return;
    }

    track.innerHTML = "";
    events.forEach((event) => {
      const article = document.createElement("article");
      article.className = "event-card";
      const eventHref = `/events/${encodeURIComponent(event.id)}`;
      article.innerHTML = `
        <h4><a class="event-link" href="${eventHref}">${escapeHtml(event.title)}</a></h4>
        <p class="event-description">${escapeHtml(event.description ?? "")}</p>
        <dl class="event-meta">
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
            <dd>${escapeHtml(event.location)}, ${escapeHtml(event.city)}</dd>
          </div>
        </dl>
      `;
      track.appendChild(article);
    });

    renderDots(events.length);
    updateActiveDot();
  } catch (error) {
    track.innerHTML = '<div class="carousel-empty">Events could not be loaded.</div>';
  }
};

const renderSessionState = async () => {
  if (!sessionSlot) {
    return;
  }

  try {
    const response = await fetch("/api/session");
    const sessionState = await response.json();

    if (sessionState.authenticated) {
      const isAdmin = sessionState.user?.role === "admin";
      sessionSlot.innerHTML = `
        <span class="session-pill">
          <span class="session-pill__label">Signed in as</span>
          <strong class="session-pill__name">${escapeHtml(sessionState.user.username)}</strong>
        </span>
        <div class="session-actions">
          <form action="/logout" method="post">
            <button class="button button-ghost" type="submit">Log out</button>
          </form>
          ${
            isAdmin
              ? '<a class="button button-primary" href="/admin">Admin panel</a>'
              : ""
          }
        </div>
      `;
      return;
    }

    sessionSlot.innerHTML = `
      <a class="button button-ghost" href="/login">Sign in</a>
      <a class="button button-primary" href="/register">Sign up</a>
    `;
  } catch (error) {
    sessionSlot.innerHTML = `
      <a class="button button-ghost" href="/login">Sign in</a>
      <a class="button button-primary" href="/register">Sign up</a>
    `;
  }
};

prevButton?.addEventListener("click", () => {
  track.scrollBy({ left: -track.clientWidth * 0.9, behavior: "smooth" });
});

nextButton?.addEventListener("click", () => {
  track.scrollBy({ left: track.clientWidth * 0.9, behavior: "smooth" });
});

track?.parentElement?.addEventListener("scroll", updateActiveDot, { passive: true });
track?.addEventListener("scroll", updateActiveDot, { passive: true });

loadEvents();
renderSessionState();
