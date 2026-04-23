const scannerCard = document.querySelector(".scanner-card");
const readerEl = document.getElementById("qr-reader");
const resultEl = document.getElementById("scan-result");
const eventId =
  scannerCard?.dataset.eventId || new URLSearchParams(window.location.search).get("eventId");

let scanner = null;
let isProcessing = false;

function showResult(message, success = false) {
  if (!resultEl) return;

  resultEl.textContent = message;
  resultEl.className = success ? "scan-result scan-result--ok" : "scan-result scan-result--error";
}

async function sendScan(decodedText) {
  const response = await fetch(`/staff/events/${encodeURIComponent(eventId)}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ qr: decodedText }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Could not validate ticket.");
  }

  showResult(data?.message || "Ticket validated successfully.", true);
} 

async function onScanSuccess(decodedText) {
  if (isProcessing || !eventId) return;

  isProcessing = true;

  try {
    await sendScan(decodedText);
  } catch (error) {
    console.error(error);
    showResult(error.message || "Network error", false);
  } finally {
    window.setTimeout(() => {
      isProcessing = false;
    }, 1500);
  }
}

function startScanner() {
  if (!readerEl || !resultEl) return;

  if (!eventId) {
    showResult("Open this page from a staff event to start scanning.", false);
    return;
  }

  if (typeof Html5QrcodeScanner === "undefined") {
    showResult("Scanner library not loaded.", false);
    return;
  }

  scanner = new Html5QrcodeScanner(
    "qr-reader",
    {
      fps: 10,
      qrbox: { width: 250, height: 250 },
    },
    false
  );

  scanner.render(onScanSuccess, () => {});
}

window.addEventListener("beforeunload", () => {
  if (!scanner) return;

  scanner.clear().catch(() => {});
});

startScanner();
