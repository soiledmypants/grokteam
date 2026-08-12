(() => {
  "use strict";

  const FEED_URL = "./data/dashboard_feed.json";
  const CA_PLACEHOLDER = "CA coming soon";

  const $ = (id) => document.getElementById(id);

  function fmtUsd(n, opts = {}) {
    if (n == null || Number.isNaN(n)) return "-";
    const abs = Math.abs(n);
    const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
    const sign = opts.signed ? (n > 0 ? "+" : n < 0 ? "−" : "") : n < 0 ? "−" : "";
    const body = abs.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    return `${sign}$${body}`;
  }

  function fmtPct(n) {
    if (n == null || Number.isNaN(n)) return "-";
    const sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return `${sign}${Math.abs(n).toFixed(1)}%`;
  }

  function fmtMcap(n) {
    if (n == null || Number.isNaN(n)) return "-";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return fmtUsd(n);
  }

  function cleanCopy(s) {
    return String(s ?? "")
      .replace(/[\u2014\u2013]/g, ", ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ",");
  }

  function escapeHtml(s) {
    return cleanCopy(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pnlClass(n) {
    if (n == null || Number.isNaN(n) || n === 0) return "pnl-flat";
    return n > 0 ? "pnl-pos" : "pnl-neg";
  }

  function relativeAge(iso) {
    if (!iso) return "-";
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return "-";
    const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  }

  function renderCaps(book) {
    const grid = $("caps-grid");
    if (!grid || !book) return;

    const rows = [
      { k: "Risk capital max", v: fmtUsd(book.risk_capital_usd_max) },
      { k: "Default entry", v: fmtUsd(book.default_entry_usd) },
      { k: "Max entry", v: fmtUsd(book.max_entry_usd) },
      { k: "Max open", v: String(book.max_open ?? "-") },
      { k: "Daily loss stop", v: fmtUsd(book.daily_loss_stop_usd, { signed: true }), cls: "warn" },
      {
        k: "auto_buy",
        v: book.auto_buy ? "true" : "false",
        cls: book.auto_buy ? "" : "false",
      },
      {
        k: "uncapped autopilot",
        v: book.uncapped_autopilot ? "true" : "false",
        cls: book.uncapped_autopilot ? "warn" : "false",
      },
      {
        k: "execution",
        v: String(book.execution_style || "auto_small_live_capped").replace(/_/g, " "),
      },
      {
        k: "per trade approval",
        v: book.per_trade_approval ? "true" : "false",
        cls: book.per_trade_approval ? "" : "false",
      },
      {
        k: "kill switch",
        v: book.kill_switch ? "true" : "false",
        cls: book.kill_switch ? "warn" : "false",
      },
      {
        k: "session reports",
        v: book.session_reports ? "true" : "false",
        cls: book.session_reports ? "" : "false",
      },
    ];

    grid.innerHTML = rows
      .map(
        (r) => `
      <div class="cap">
        <span class="cap-k">${escapeHtml(r.k)}</span>
        <span class="cap-v ${r.cls || ""}">${escapeHtml(r.v)}</span>
      </div>`
      )
      .join("");
  }

  function renderOpen(positions) {
    const grid = $("open-grid");
    if (!grid) return;

    if (!positions || !positions.length) {
      grid.innerHTML = `<div class="empty-state">No open positions</div>`;
      return;
    }

    grid.innerHTML = positions
      .map((p) => {
        const grade = (p.setup_grade || "?").toUpperCase();
        const markPending = p.pnl_usd == null && p.pnl_pct == null;
        const link = p.url
          ? `<div class="pos-link"><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">pump.fun ↗</a></div>`
          : "";

        return `
        <article class="pos-card" role="listitem" data-id="${escapeHtml(p.id || p.ticker)}">
          <div class="pos-left">
            <div class="pos-top">
              <div class="pos-ticker-row">
                <span class="pos-ticker">$${escapeHtml(p.ticker)}</span>
                <span class="pos-name">${escapeHtml(p.name || "")}</span>
              </div>
              <span class="grade grade-${escapeHtml(grade)}" title="setup grade">GRADE ${escapeHtml(grade)}</span>
            </div>
            <div class="pos-metrics">
              <div>
                <span class="metric-k">Notional</span>
                <span class="metric-v">${escapeHtml(fmtUsd(p.notional_usd))}</span>
              </div>
              <div>
                <span class="metric-k">Entry mcap</span>
                <span class="metric-v">${escapeHtml(fmtMcap(p.entry_mcap_usd))}</span>
              </div>
              <div>
                <span class="metric-k">Curve @ entry</span>
                <span class="metric-v">${p.curve_pct_at_entry != null ? escapeHtml(p.curve_pct_at_entry.toFixed(1) + "%") : ", "}</span>
              </div>
              <div>
                <span class="metric-k">Mark / PnL</span>
                <span class="metric-v ${markPending ? "pending" : pnlClass(p.pnl_usd)}">
                  ${markPending ? "- · mark pending" : `${escapeHtml(fmtUsd(p.pnl_usd, { signed: true }))} · ${escapeHtml(fmtPct(p.pnl_pct))}`}
                </span>
              </div>
            </div>
          </div>
          <div class="pos-right">
            <div>
              <div class="block-label">Thesis</div>
              <p class="block-body">${escapeHtml(p.thesis)}</p>
            </div>
            <div>
              <div class="block-label">Invalidation</div>
              <p class="block-body inv">${escapeHtml(p.invalidation)}</p>
            </div>
            ${link}
          </div>
        </article>`;
      })
      .join("");
  }

  function renderClosed(positions) {
    const body = $("closed-body");
    if (!body) return;

    if (!positions || !positions.length) {
      body.innerHTML = `<tr><td colspan="5" class="empty-state" style="border:none">No closed positions</td></tr>`;
      return;
    }

    body.innerHTML = positions
      .map((p) => {
        const grade = (p.grade || "?").toUpperCase();
        return `
        <tr>
          <td><span class="closed-ticker">$${escapeHtml(p.ticker)}</span></td>
          <td><span class="grade grade-${escapeHtml(grade)}">${escapeHtml(grade)}</span></td>
          <td>
            <span class="closed-pnl ${pnlClass(p.pnl_usd)}">
              ${escapeHtml(fmtUsd(p.pnl_usd, { signed: true }))}
              <small>${escapeHtml(fmtPct(p.pnl_pct))}</small>
            </span>
          </td>
          <td><div class="closed-rule">${escapeHtml(p.exit_rule || "-")}</div></td>
          <td class="hide-sm"><div class="closed-thesis">${escapeHtml(p.thesis || "-")}</div></td>
        </tr>`;
      })
      .join("");
  }




  function renderTreasury(treasury) {
    const t = treasury || {};
    const walletEl = $("treasury-value");
    const statusEl = $("fee-status");
    const caEl = $("ca-value");
    const wallet = t.trading_wallet || t.fee_destination_wallet;
    if (walletEl) {
      walletEl.textContent = wallet || "trading wallet soon";
    }
    if (statusEl) {
      const st = t.fee_routing_status || "pending";
      statusEl.textContent = "fee routing: " + String(st).replace(/_/g, " ");
    }
    if (caEl && t.project_coin_mint) {
      caEl.textContent = t.project_coin_mint;
    }
  }


  function renderSetup(setup) {
    const grid = $("setup-grid");
    const detail = $("setup-detail");
    const s = setup || {};
    const rows = [
      ["burner funded", !!s.burner_wallet_funded],
      ["rpc ready", !!s.rpc_ready],
      ["execution path", !!s.execution_path_ready],
      ["secure key", !!s.secure_key_stored],
      ["session greenlight", !!s.user_session_greenlight],
      ["project mint", !!s.project_coin_mint_known],
      ["fee routing", !!s.fee_routing_configured],
    ];
    if (grid) {
      grid.innerHTML = rows.map(([k, ok]) => `
        <div class="cap">
          <span class="cap-k">${escapeHtml(k)}</span>
          <span class="cap-v ${ok ? "" : "false"}">${ok ? "ready" : "pending"}</span>
        </div>`).join("");
    }
    if (detail) {
      const note = String(s.note || "").replace(/[\u2014\u2013]/g, ", ");
      const pk = s.burner_pubkey ? ("burner " + s.burner_pubkey) : "";
      const sol = s.burner_sol != null ? ("sol " + s.burner_sol) : "";
      detail.textContent = [note, pk, sol].filter(Boolean).join(" · ");
    }
  }

  function renderHeader(feed) {
    // Public modes: setup | live. Unknown modes coerce to setup.
    const rawMode = (feed.mode || "setup").toLowerCase();
    const mode = rawMode === "live" ? "live" : "setup";
    const modeLabel = mode.toUpperCase();
    const pnl = feed.pnl || {};
    const book = feed.book || {};
    const openCount = pnl.open_count ?? (feed.open_positions || []).length;
    const closedCount = pnl.closed_count ?? (feed.closed_positions || []).length;
    const realized = pnl.realized_usd;

    const badge = $("mode-badge");
    if (badge) {
      badge.textContent = modeLabel;
      badge.classList.toggle("pill-setup", mode === "setup"); // amber = not live yet
      badge.classList.toggle("pill-live", mode === "live");
    }

    const realizedEl = $("realized-pnl");
    if (realizedEl) {
      realizedEl.textContent = fmtUsd(realized, { signed: true });
      realizedEl.className = `stat-value mono ${pnlClass(realized)}`;
    }

    if ($("open-count")) $("open-count").textContent = String(openCount);
    if ($("closed-count")) $("closed-count").textContent = String(closedCount);
    if ($("stat-mode")) $("stat-mode").textContent = modeLabel;
    if ($("meta-mode")) $("meta-mode").textContent = modeLabel;
    if ($("meta-autobuy")) $("meta-autobuy").textContent = book.auto_buy ? "true" : "false";

    if ($("status-mode")) $("status-mode").textContent = mode;
    const led = $("status-led");
    if (led) {
      led.classList.toggle("setup", mode === "setup");
      led.classList.toggle("live", mode === "live");
    }
    if ($("status-open")) $("status-open").textContent = String(openCount);
    if ($("status-closed")) $("status-closed").textContent = String(closedCount);
    if ($("status-autobuy")) $("status-autobuy").textContent = book.auto_buy ? "true" : "false";
    const setup = feed.setup || {};
    if ($("setup-note")) {
      const ready = [setup.burner_ready && "burner", setup.rpc_ready && "rpc", setup.signing_ready && "signing"].filter(Boolean);
      $("setup-note").textContent = setup.note || (ready.length ? ready.join(" · ") + " ready" : "setup pending");
    }
    if ($("pos-count")) $("pos-count").textContent = String(openCount);

    const stamp = feed.generated_utc || feed.updated_at;
    const updateLast = () => {
      if ($("last-update")) $("last-update").textContent = relativeAge(stamp).replace(" ago", "");
    };
    updateLast();
    if (window.__tgtUpdateTimer) clearInterval(window.__tgtUpdateTimer);
    window.__tgtUpdateTimer = setInterval(updateLast, 5000);
  }

  function wireCa() {
    const field = $("ca-field");
    const value = $("ca-value");
    const label = $("ca-copy-label");
    if (!field || !value) return;

    const copy = async () => {
      const text = value.textContent.trim();
      if (!text || text === CA_PLACEHOLDER) {
        if (label) {
          label.textContent = "Soon";
          setTimeout(() => (label.textContent = "Copy"), 1200);
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        if (label) {
          label.textContent = "Copied";
          setTimeout(() => (label.textContent = "Copy"), 1400);
        }
      } catch {
        if (label) label.textContent = "Fail";
      }
    };

    field.addEventListener("click", copy);
    field.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        copy();
      }
    });
    $("ca-copy")?.addEventListener("click", (e) => {
      e.stopPropagation();
      copy();
    });
  }

  async function loadFeed() {
    try {
      const res = await fetch(FEED_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const feed = await res.json();

      renderHeader(feed);
      renderCaps(feed.book);
      renderTreasury(feed.treasury);
      renderSetup(feed.setup);
      renderOpen(feed.open_positions || []);
      renderClosed(feed.closed_positions || []);
    } catch (err) {
      console.error("Feed load failed", err);
      const grid = $("open-grid");
      if (grid) {
        grid.innerHTML = `<div class="error-state">Could not load ${FEED_URL}. Serve the folder over HTTP (not file://) so fetch works.</div>`;
      }
    }
  }

  wireCa();
  loadFeed();
})();
