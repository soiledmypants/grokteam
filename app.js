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

  function fmtSol(n) {
    if (n == null || Number.isNaN(Number(n))) return "-";
    const v = Number(n);
    const abs = Math.abs(v);
    let digits = 4;
    if (abs >= 100) digits = 2;
    else if (abs >= 1) digits = 3;
    else if (abs >= 0.01) digits = 4;
    else digits = 6;
    return `${abs.toFixed(digits).replace(/\.?0+$/, "") || "0"} SOL`;
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


  function shortAddr(s) {
    if (s == null || s === "") return "-";
    const str = String(s);
    if (str.length <= 10) return str;
    return str.slice(0, 4) + "…" + str.slice(-4);
  }

  function coinImage(p) {
    if (!p) return "";
    const candidates = [
      p.image_url,
      p.image_uri,
      p.image,
      p.logo_uri,
      p.metadata && p.metadata.image,
    ];
    for (const c of candidates) {
      if (c != null && String(c).trim()) return String(c).trim();
    }
    return "";
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
        const grade = (p.setup_grade || p.grade || "?").toUpperCase();
        const gradeKey = grade.replace(/[^A-Za-z0-9]/g, "") || "X";
        const uPnl = p.unrealized_usd != null ? p.unrealized_usd : p.pnl_usd;
        const markPending = p.unrealized_usd == null && p.pnl_usd == null;
        const markLine = markPending
          ? "- · mark pending"
          : `${fmtUsd(uPnl, { signed: true })} · ${fmtPct(p.pnl_pct)}` +
            (p.unrealized_sol != null ? ` · ${fmtSol(p.unrealized_sol)}` : "");
        const img = coinImage(p);
        const letter = String(p.ticker || "?").trim().charAt(0).toUpperCase() || "?";
        const avatar = img
          ? `<div class="pos-avatar"><img src="${escapeHtml(img)}" alt="" loading="lazy" /></div>`
          : `<div class="pos-avatar placeholder" aria-hidden="true">${escapeHtml(letter)}</div>`;
        const decisionRaw = p.decision ? String(p.decision).toUpperCase() : "";
        const decisionCls = decisionRaw === "HOLD" ? "is-hold" : decisionRaw === "EXIT" || decisionRaw === "SELL" ? "is-exit" : decisionRaw ? "is-on" : "";
        const decision = decisionRaw
          ? `<span class="decision-badge ${decisionCls}">${escapeHtml(decisionRaw)}</span>`
          : "";
        const mint = p.mint || p.ca || "";
        const mintLine = mint
          ? `<div class="pos-mint" title="${escapeHtml(mint)}"><span class="metric-k">Mint / CA</span><code class="mono">${escapeHtml(mint)}</code> <span class="copy-hint">copy</span></div>`
          : `<div class="pos-mint"><span class="metric-k">Mint / CA</span><code class="mono">-</code></div>`;
        const entrySig = p.entry_sig || "";
        const solscan = p.solscan || "#";
        const sigHref = p.solscan ? escapeHtml(p.solscan) : "#";
        const sigLine = `<div class="pos-sig"><span class="metric-k">Entry sig</span><a class="mono" href="${sigHref}" ${p.solscan ? 'target="_blank" rel="noopener noreferrer"' : ""} title="${escapeHtml(entrySig || "")}">${escapeHtml(shortAddr(entrySig))}</a></div>`;
        const desc = p.description
          ? `<div>
              <div class="block-label">Coin</div>
              <p class="block-body">${escapeHtml(p.description)}</p>
            </div>`
          : "";
        const links = [];
        if (p.url) {
          links.push(`<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer">pump.fun ↗</a>`);
        }
        if (p.solscan) {
          links.push(`<a href="${escapeHtml(p.solscan)}" target="_blank" rel="noopener noreferrer">solscan entry ↗</a>`);
        }
        const linksRow = links.length
          ? `<div class="pos-links">${links.join("")}</div>`
          : "";

        return `
        <article class="pos-card" role="listitem" data-id="${escapeHtml(p.id || p.ticker)}">
          <div class="pos-left">
            <div class="pos-head">
              ${avatar}
              <div class="pos-head-main">
                <div class="pos-top">
                  <div class="pos-ticker-row">
                    <span class="pos-ticker">$${escapeHtml(p.ticker)}</span>
                    <span class="pos-name">${escapeHtml(p.name || "")}</span>
                  </div>
                  <div class="pos-badges">
                    <span class="grade grade-${escapeHtml(gradeKey)}" title="setup grade">GRADE ${escapeHtml(grade)}</span>
                    ${decision}
                  </div>
                </div>
              </div>
            </div>
            <div class="pos-metrics">
              <div>
                <span class="metric-k">Notional</span>
                <span class="metric-v">${p.notional_sol != null ? escapeHtml(String(p.notional_sol) + " SOL") : escapeHtml(fmtUsd(p.notional_usd))}</span>
              </div>
              <div>
                <span class="metric-k">Entry mcap</span>
                <span class="metric-v">${escapeHtml(fmtMcap(p.entry_mcap_usd))}</span>
              </div>
              <div>
                <span class="metric-k">Mark mcap</span>
                <span class="metric-v">${escapeHtml(fmtMcap(p.mark_mcap_usd))}</span>
              </div>
              <div>
                <span class="metric-k">Mark / PnL</span>
                <span class="metric-v ${markPending ? "pending" : pnlClass(uPnl)}">
                  ${markPending ? "- · mark pending" : escapeHtml(markLine)}
                </span>
              </div>
              <div>
                <span class="metric-k">ATH dump</span>
                <span class="metric-v">${p.ath_dump_pct != null ? escapeHtml(Number(p.ath_dump_pct).toFixed(1) + "%") : "-"}</span>
              </div>
              <div>
                <span class="metric-k">Decision</span>
                <span class="metric-v">${decisionRaw ? escapeHtml(decisionRaw) : "-"}</span>
              </div>
            </div>
            ${mintLine}
            ${sigLine}
          </div>
          <div class="pos-right">
            <div>
              <div class="block-label">Thesis</div>
              <p class="block-body">${escapeHtml(p.thesis)}</p>
            </div>
            ${p.decision_note ? `<div><div class="block-label">Decision note</div><p class="block-body">${escapeHtml(p.decision_note)}</p></div>` : ""}
            ${desc}
            <div>
              <div class="block-label">Invalidation</div>
              <p class="block-body inv">${escapeHtml(p.invalidation)}</p>
            </div>
            ${linksRow}
          </div>
        </article>`;
      })
      .join("");
  }

  function renderClosed(positions) {
    const body = $("closed-body");
    if (!body) return;

    if (!positions || !positions.length) {
      body.innerHTML = `<tr><td colspan="7" class="empty-state" style="border:none">No closed positions</td></tr>`;
      return;
    }

    body.innerHTML = positions
      .map((p) => {
        const grade = (p.setup_grade || p.grade || "?").toUpperCase();
        const gradeKey = grade.replace(/[^A-Za-z0-9]/g, "") || "X";
        const img = coinImage(p);
        const letter = String(p.ticker || "?").trim().charAt(0).toUpperCase() || "?";
        const thumb = img
          ? `<img class="closed-thumb" src="${escapeHtml(img)}" alt="" loading="lazy" />`
          : `<span class="closed-thumb placeholder" aria-hidden="true">${escapeHtml(letter)}</span>`;
        const mint = p.mint || p.ca || "";
        const entryHref = p.solscan ? escapeHtml(p.solscan) : "#";
        const exitHref = p.solscan_exit ? escapeHtml(p.solscan_exit) : "#";
        const entryLink = p.entry_sig
          ? `<a class="mono" href="${entryHref}" ${p.solscan ? 'target="_blank" rel="noopener noreferrer"' : ""} title="${escapeHtml(p.entry_sig)}">${escapeHtml(shortAddr(p.entry_sig))}</a>`
          : "-";
        const exitLink = p.exit_sig
          ? `<a class="mono" href="${exitHref}" ${p.solscan_exit ? 'target="_blank" rel="noopener noreferrer"' : ""} title="${escapeHtml(p.exit_sig)}">${escapeHtml(shortAddr(p.exit_sig))}</a>`
          : "-";
        const exitTxt = p.exit_reason || p.exit_rule || "-";
        return `
        <tr>
          <td>
            <div class="closed-ticker-cell">
              ${thumb}
              <div>
                <span class="closed-ticker">$${escapeHtml(p.ticker)}</span>
                <div class="closed-name">${escapeHtml(p.name || "")}</div>
              </div>
            </div>
          </td>
          <td><span class="grade grade-${escapeHtml(gradeKey)}">${escapeHtml(grade)}</span></td>
          <td>
            <span class="closed-pnl ${pnlClass(p.pnl_usd)}">
              ${escapeHtml(fmtUsd(p.pnl_usd, { signed: true }))}
              <small>${escapeHtml(fmtPct(p.pnl_pct))}</small>
            </span>
          </td>
          <td>
            <div class="pos-mint closed-mint" title="${escapeHtml(mint)}"><code class="mono">${escapeHtml(shortAddr(mint))}</code></div>
          </td>
          <td>
            <div class="pos-sig closed-sigs">
              <span>in ${entryLink}</span>
              <span>out ${exitLink}</span>
            </div>
          </td>
          <td><div class="closed-rule">${escapeHtml(exitTxt)}</div></td>
          <td class="hide-sm"><div class="closed-thesis">${escapeHtml(p.thesis || "-")}</div></td>
        </tr>`;
      })
      .join("");
  }





  function renderTreasury(treasury, feed) {
    const t = treasury || {};
    const book = (feed && feed.book) || {};
    const walletEl = $("treasury-value");
    const statusEl = $("fee-status");
    const caEl = $("ca-value");
    const caCopyText = $("ca-copy-text");
    const wallet =
      t.trading_wallet ||
      t.fee_destination_wallet ||
      "GRok4tm5vfjVQobbe2UMznM7SkuMonPayA1Zk1m2uPRU";
    if (walletEl) {
      walletEl.textContent = wallet;
    }

    const mint =
      t.project_coin_mint ||
      book.project_coin_mint ||
      (feed && feed.project_coin_mint) ||
      null;

    const setup = (feed && feed.setup) || {};
    const feeActive = !!(mint && (t.fee_routing_status === "active" || t.fee_mechanism === "auto_swap"));
    const dexPaid = !!setup.dex_paid;

    const badgeFee = $("badge-fee-routing");
    if (badgeFee) {
      badgeFee.textContent = feeActive ? "auto-swap active" : "fee routing pending";
      badgeFee.classList.toggle("is-on", feeActive);
      badgeFee.classList.toggle("is-warn", !feeActive);
    }
    const badgeDex = $("badge-dex-paid");
    if (badgeDex) {
      badgeDex.textContent = dexPaid ? "dex paid" : "dex unpaid";
      badgeDex.classList.toggle("is-on", dexPaid);
      badgeDex.classList.toggle("is-warn", !dexPaid);
    }
    const burnerEl = $("burner-sol");
    if (burnerEl) {
      burnerEl.textContent = setup.burner_sol != null ? String(setup.burner_sol) : "-";
    }
    const mechEl = $("fee-mechanism");
    if (mechEl) {
      mechEl.textContent = String(t.fee_mechanism || "-").replace(/_/g, " ");
    }

    if (statusEl) {
      if (feeActive) {
        statusEl.textContent = "fee routing: auto-swap → trading wallet · capital inside caps";
      } else if (mint) {
        statusEl.textContent = "fee routing: mint live · wiring auto-swap → trading wallet";
      } else {
        const st = t.fee_routing_status || "waiting_on_project_mint";
        statusEl.textContent = "fee routing: " + String(st).replace(/_/g, " ");
      }
    }

    const pumpLink = $("ca-pump-link");
    if (pumpLink) {
      if (mint) {
        pumpLink.href = "https://pump.fun/coin/" + mint;
        pumpLink.style.display = "";
      } else {
        pumpLink.style.display = "none";
      }
    }

    if (caEl) {
      if (mint) {
        caEl.textContent = mint;
        if (caCopyText) {
          caCopyText.textContent =
            "official project mint. fees auto-swap to the trading wallet for more small buys under caps. verify against @thegrokteam only.";
        }
      } else if (!caEl.textContent || caEl.textContent === CA_PLACEHOLDER) {
        caEl.textContent = CA_PLACEHOLDER;
      }
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
      ["dex paid", !!s.dex_paid],
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
    const unrealized = pnl.unrealized_usd;

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

    const unrealizedEl = $("unrealized-pnl");
    if (unrealizedEl) {
      unrealizedEl.textContent = fmtUsd(unrealized, { signed: true });
      unrealizedEl.className = `stat-value mono ${pnlClass(unrealized)}`;
    }

    const solUsdEl = $("sol-usd");
    if (solUsdEl) {
      solUsdEl.textContent = pnl.sol_usd != null ? `sol ${fmtUsd(pnl.sol_usd)}` : "";
    }

    if ($("status-unrealized")) {
      $("status-unrealized").textContent = fmtUsd(unrealized, { signed: true });
      $("status-unrealized").className = pnlClass(unrealized);
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

      dashCache = feed;
      renderHeader(feed);
      renderCaps(feed.book);
      renderTreasury(feed.treasury, feed);
      renderSetup(feed.setup);
      renderOpen(feed.open_positions || []);
      renderClosed(feed.closed_positions || []);
      renderPow();
    } catch (err) {
      console.error("Feed load failed", err);
      const grid = $("open-grid");
      if (grid) {
        grid.innerHTML = `<div class="error-state">Could not load ${FEED_URL}. Serve the folder over HTTP (not file://) so fetch works.</div>`;
      }
    }
  }


  const POW_URL = "./data/pow_feed.json";
  const FEED_URL_DUP = FEED_URL; // dashboard
  let powAgent = "nova";
  let powCache = null;
  let dashCache = null;

  function sortEntries(entries) {
    return (entries || []).slice().sort((a, b) => Date.parse(b.ts_utc || 0) - Date.parse(a.ts_utc || 0));
  }

  function novaTradeEntries(feed) {
    const out = [];
    for (const p of feed.open_positions || []) {
      const uPnl = p.unrealized_usd != null ? p.unrealized_usd : p.pnl_usd;
      const pnlBit = uPnl == null ? "" : " · " + fmtUsd(uPnl, { signed: true });
      const imgUrl = coinImage(p);
      const meta = {
        status: "open",
        mint: p.mint,
        url: p.url,
        notional_usd: p.notional_usd,
        entry_mcap_usd: p.entry_mcap_usd,
      };
      if (imgUrl) {
        meta.image_url = imgUrl;
        if (p.image_uri) meta.image_uri = p.image_uri;
      }
      if (p.mark_mcap_usd != null) meta.mark_mcap_usd = p.mark_mcap_usd;
      if (p.unrealized_usd != null) meta.unrealized_usd = p.unrealized_usd;
      if (p.pnl_pct != null) meta.pnl_pct = p.pnl_pct;
      out.push({
        id: "trade-open-" + (p.id || p.ticker),
        ts_utc: p.entry_ts_utc || p.updated_utc || feed.generated_utc,
        kind: "trade",
        title: "open $" + (p.ticker || "?") + (p.setup_grade ? " · grade " + p.setup_grade : "") + pnlBit,
        body: (p.thesis || "thesis pending") + (p.invalidation ? " | invalidate: " + p.invalidation : ""),
        meta,
      });
    }
    for (const p of feed.closed_positions || []) {
      const pnl = p.pnl_usd == null ? "" : " · " + fmtUsd(p.pnl_usd, { signed: true });
      out.push({
        id: "trade-closed-" + (p.id || p.ticker),
        ts_utc: p.updated_utc || feed.generated_utc,
        kind: "trade",
        title: "closed $" + (p.ticker || "?") + pnl,
        body: (p.thesis || "-") + (p.exit_rule ? " | exit: " + p.exit_rule : ""),
        meta: (() => {
          const imgUrl = coinImage(p);
          const m = { status: "closed", mint: p.mint, pnl_usd: p.pnl_usd, pnl_pct: p.pnl_pct };
          if (imgUrl) m.image_url = imgUrl;
          if (p.image_uri) m.image_uri = p.image_uri;
          return m;
        })(),
      });
    }
    return out;
  }

  function renderPow() {
    const root = $("pow-feed");
    if (!root || !powCache) return;
    const agent = powCache.agents && powCache.agents[powAgent];
    let entries = agent ? sortEntries(agent.entries) : [];
    if (powAgent === "nova" && dashCache) {
      const trades = novaTradeEntries(dashCache);
      const ids = new Set(entries.map((e) => e.id));
      for (const t of trades) {
        if (!ids.has(t.id)) entries.push(t);
      }
      entries = sortEntries(entries);
    }
    if ($("pow-updated")) {
      $("pow-updated").textContent = relativeAge(powCache.updated_utc).replace(" ago", "") || "-";
    }
    if (!entries.length) {
      root.innerHTML = `<div class="empty-state">no pow entries yet for ${escapeHtml(powAgent)}</div>`;
      return;
    }
    root.innerHTML = entries
      .map((e) => {
        const link = e.meta && e.meta.url
          ? `<a class="pow-link" href="${escapeHtml(e.meta.url)}" target="_blank" rel="noopener noreferrer">open ↗</a>`
          : "";
        const thumbSrc = e.meta && (e.meta.image_url || e.meta.image_uri);
        const thumb = thumbSrc
          ? `<img class="pow-thumb" src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" />`
          : "";
        return `<article class="pow-item">
          <div>
            <div class="pow-time mono">${escapeHtml(relativeAge(e.ts_utc))}</div>
            <div class="pow-kind">${escapeHtml(e.kind || "note")}</div>
          </div>
          <div>
            <div class="pow-title-row">${thumb}<h3 class="pow-title">${escapeHtml(e.title || "")}</h3></div>
            <p class="pow-body">${escapeHtml(cleanCopy(e.body || ""))}</p>
            ${link}
          </div>
        </article>`;
      })
      .join("");
  }

  function wirePowTabs() {
    document.querySelectorAll(".pow-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        powAgent = btn.getAttribute("data-agent") || "nova";
        document.querySelectorAll(".pow-tab").forEach((b) => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-selected", on ? "true" : "false");
        });
        renderPow();
      });
    });
  }

  async function loadPow() {
    try {
      const res = await fetch(POW_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("pow http " + res.status);
      powCache = await res.json();
      renderPow();
    } catch (err) {
      console.error(err);
      const root = $("pow-feed");
      if (root) root.innerHTML = `<div class="error-state">could not load pow feed</div>`;
    }
  }

  function wireMintCopy() {
    document.addEventListener("click", async (e) => {
      const mint = e.target.closest && e.target.closest(".pos-mint");
      if (!mint) return;
      const code = mint.querySelector("code");
      const full = mint.getAttribute("title") || (code && code.textContent) || "";
      if (!full || full === "-") return;
      try {
        await navigator.clipboard.writeText(full);
        const hint = mint.querySelector(".copy-hint");
        if (hint) {
          hint.textContent = "copied";
          setTimeout(() => (hint.textContent = "copy"), 1200);
        }
      } catch {
        /* ignore */
      }
    });
  }


  function wireTreasuryCopy() {
    const field = $("treasury-field");
    const value = $("treasury-value");
    const label = $("treasury-copy-label");
    if (!field || !value) return;
    const copy = async () => {
      const text = value.textContent.trim();
      if (!text) return;
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
    $("treasury-copy")?.addEventListener("click", (e) => {
      e.stopPropagation();
      copy();
    });
  }

  wirePowTabs();
  wireCa();
  wireTreasuryCopy();
  wireMintCopy();
  loadFeed();
  loadPow();
  setInterval(loadPow, 8000);
  setInterval(loadFeed, 15000);
})();
