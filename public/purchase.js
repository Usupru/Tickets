const titleSlot = document.querySelector("[data-event-title]");
const descriptionSlot = document.querySelector("[data-event-description]");
const priceSlot = document.querySelector("[data-event-price]");
const seatsSlot = document.querySelector("[data-remaining-seats]");
const locationSlot = document.querySelector("[data-event-location]");
const dateSlot = document.querySelector("[data-event-date]");
const eventIdInput = document.querySelector("[data-event-id]");
const quantitySelect = document.querySelector("[data-quantity-select]");
const totalValue = document.querySelector("[data-total-value]");
const totalHint = document.querySelector("[data-total-hint]");
const submitButton = document.querySelector("[data-submit-button]");
const statusSlot = document.querySelector("[data-status-slot]");
const backLink = document.querySelector("[data-back-link]");

const params = new URLSearchParams(window.location.search);
const eventId = params.get("eventId");

submitButton.disabled = true;
quantitySelect.disabled = true;
statusSlot.innerHTML = '<div class="purchase-banner">Loading event...</div>';

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

const renderUnavailable = (message) => {
  statusSlot.innerHTML = `<div class="purchase-banner purchase-banner--warn">${escapeHtml(message)}</div>`;
  quantitySelect.innerHTML = "";
  quantitySelect.disabled = true;
  submitButton.disabled = true;
  totalValue.textContent = "--";
  totalHint.textContent = "Choose another event from the home page.";
};

const updateTotal = (price) => {
  const quantity = Number(quantitySelect.value || 1);
  const total = Number(price ?? 0) * quantity;
  totalValue.textContent = formatPrice(total);
  totalHint.textContent = `${quantity} ticket${quantity === 1 ? "" : "s"} selected.`;
};

const renderQuantityOptions = (maxQuantity) => {
  quantitySelect.innerHTML = "";

  for (let index = 1; index <= maxQuantity; index += 1) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${index} ticket${index === 1 ? "" : "s"}`;
    quantitySelect.appendChild(option);
  }
};

const loadEvent = async () => {
  if (!eventId) {
    renderUnavailable("Missing event id in the URL.");
    return;
  }

  eventIdInput.value = eventId;
  backLink.href = `/events/${encodeURIComponent(eventId)}`;

  try {
    const response = await fetch("/api/events");
    const events = await response.json();

    if (!response.ok || !Array.isArray(events)) {
      throw new Error("Invalid events payload.");
    }

    const event = events.find((item) => item.id === eventId);

    if (!event) {
      renderUnavailable("The selected event could not be found.");
      return;
    }

    const remainingSeats = Number(event.remaining_seats ?? event.capacity ?? 0);
    const maxQuantity = Math.min(4, Math.max(remainingSeats, 0));

    titleSlot.textContent = event.title;
    descriptionSlot.textContent = event.description || "No description available.";
    priceSlot.textContent = formatPrice(event.price ?? 0);
    seatsSlot.textContent = String(remainingSeats);
    locationSlot.textContent = `${event.location}, ${event.city}`;
    dateSlot.textContent = formatDate(event.date);

    if (maxQuantity < 1) {
      renderUnavailable("This event is sold out.");
      return;
    }

    renderQuantityOptions(maxQuantity);
    updateTotal(event.price ?? 0);
    quantitySelect.disabled = false;
    submitButton.disabled = false;

    quantitySelect.addEventListener("change", () => updateTotal(event.price ?? 0));

    if (quantitySelect.value !== "1") {
      quantitySelect.value = "1";
      updateTotal(event.price ?? 0);
    }

    statusSlot.innerHTML = `<div class="purchase-banner">You can reserve up to ${maxQuantity} ticket${maxQuantity === 1 ? "" : "s"} here.</div>`;
  } catch (error) {
    renderUnavailable("Could not load the event.");
  }
};

loadEvent();
