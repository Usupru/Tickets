const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderErrorPage = ({
  statusCode = 500,
  title = "Something went wrong",
  message = "The server could not complete the request.",
  details = "",
  actionLabel = "Go home",
  actionHref = "/",
} = {}) => {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeDetails = details ? escapeHtml(details) : "";
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionHref = escapeHtml(actionHref);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${statusCode} | ${safeTitle}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="icon" href="/TicketsIcon.ico" type="image/x-icon" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0f14;
        --surface: rgba(17, 23, 32, 0.92);
        --border: rgba(255, 255, 255, 0.08);
        --text: #e7edf5;
        --muted: #93a1b4;
        --accent: #ffffff;
        --shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.05), transparent 28%),
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.03), transparent 22%),
          var(--bg);
        color: var(--text);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      a {
        color: inherit;
        text-decoration: none;
      }
      .error-shell {
        width: min(760px, 100%);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 28px;
        box-shadow: var(--shadow);
        padding: 32px;
      }
      .error-kicker {
        margin: 0 0 10px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.78rem;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.2rem, 5vw, 4rem);
        line-height: 1;
        letter-spacing: -0.05em;
      }
      .error-code {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        margin-top: 18px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid var(--border);
        font-size: 0.85rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .error-message {
        margin: 18px 0 0;
        color: var(--muted);
        line-height: 1.7;
        max-width: 60ch;
      }
      .error-details {
        margin: 16px 0 0;
        padding: 16px 18px;
        border-radius: 18px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.03);
        color: var(--text);
        line-height: 1.6;
        white-space: pre-wrap;
      }
      .error-actions {
        margin-top: 24px;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 12px;
        border: 1px solid transparent;
        font-weight: 600;
        background: var(--accent);
        color: #0b0f14;
      }
      @media (max-width: 640px) {
        .error-shell { padding: 24px; border-radius: 24px; }
      }
    </style>
  </head>
  <body>
    <main class="error-shell">
      <p class="error-kicker">Error page</p>
      <h1>${safeTitle}</h1>
      <div class="error-code">HTTP ${statusCode}</div>
      <p class="error-message">${safeMessage}</p>
      ${safeDetails ? `<div class="error-details">${safeDetails}</div>` : ""}
      <div class="error-actions">
        <a class="button" href="${safeActionHref}">${safeActionLabel}</a>
      </div>
    </main>
  </body>
</html>`;
};
