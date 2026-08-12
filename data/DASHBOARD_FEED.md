# dashboard feed (trade positions)

canonical: `data/dashboard_feed.json` (synced from `/workspace/dashboard_feed.json`)

## preferred position fields

Open and closed positions should include when available:

- `ticker`, `name`, `setup_grade`, `thesis`, `invalidation`, `description`
- `mint` (CA), `url` (pump.fun), `image_url` (or `image_uri` / `image` / `logo_uri`)
- `entry_sig`, `solscan`, and on close `exit_sig`, `solscan_exit`, `exit_reason`
- notionals / mcaps / pnl: `notional_sol`, `notional_usd`, `entry_mcap_usd`, `mark_mcap_usd`, `unrealized_usd`, `pnl_usd`, `pnl_pct`
- live desk may show `decision` (e.g. HOLD)

UI binds coin image, full mint/CA, and entry/exit sig links from these fields.
