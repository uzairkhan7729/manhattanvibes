# 13 — Kitchen Display System (KDS)

> Replaces paper tickets. PWA running fullscreen on a kitchen monitor (Chromium kiosk mode). Real-time via Socket.IO.

## 1. Hardware

- 24"–32" landscape monitor at each kitchen station.
- Optional bump bar (Logic Controls, ELO) or touchscreen.
- Single PC per kitchen runs Chromium in kiosk; one tab per station OR multiple monitors via display extender.

## 2. Stack

| Concern | Choice |
|---|---|
| Framework | React 18 |
| Realtime | Socket.IO client (`/kds` ns) |
| State | Redux Toolkit (light) |
| Style | Tailwind, dark theme, high-contrast |
| Sound | Web Audio API for bump chimes |
| Hardware | Bump-bar via Keyboard events; printers via local print server (via POS edge node) |
| Build | Vite |

## 3. Layout

```
┌───────────────────────────────────────────────────────────────┐
│  Branch RUH-1 ▸ Pizza Station       ⏱ 12:48      ⚙           │
├──────────────┬──────────────┬──────────────┬──────────────────┤
│ INCOMING (4) │ PREPARING (2)│ BAKING (3)   │ READY (1)        │
│              │              │              │                  │
│ ┌─ #000234 ─┐│ ┌─ #000232 ─┐│ ┌─ #000228 ─┐│ ┌─ #000226 ─┐    │
│ │ Pizza L  ││ │ Pizza M  ││ │ Pizza XL ││ │ Pizza L  │    │
│ │ +pepperoni││ │ +olives  ││ │ +chicken ││ │ thin     │    │
│ │ 01:00     ││ │ 04:22    ││ │ 07:15    ││ │ READY    │    │
│ │ [BUMP]    ││ │ [BUMP]   ││ │ [BUMP]   ││ │ [DONE]   │    │
│ └──────────┘│ └──────────┘│ └──────────┘│ └──────────┘    │
│ ┌─ #000235 ─┐│ ┌─ #000233 ─┐│ ┌─ #000229 ─┐│                  │
│ │ ...       ││ │ ...      ││ │ ...      ││                  │
└──────────────┴──────────────┴──────────────┴──────────────────┘
```

- Columns: **Incoming → Preparing → Baking → Ready** (plus **Completed** archive accessible by tap).
- Card colors escalate based on SLA timer: green → yellow → red after target.
- Audio chime on new incoming; quieter chime on item bump.
- Order-type icon (dine-in/take-away/delivery/pickup) prominently displayed.

## 4. Station Routing

Each order item carries `stationTags` derived from its product (pizza station, cold station, drinks). KDS instance is configured `?branch=RUH-1&station=pizza` and shows only items matching its station.

A master KDS view (manager-only) shows all stations for overall flow visibility.

## 5. Realtime Events

`/kds` namespace, room `branch:RUH-1:station:pizza`:

| Event | Direction | Payload |
|---|---|---|
| `order.confirmed` | server → KDS | order full payload |
| `order.bumped` | server → KDS | id, fromState, toState |
| `order.item.state` | server → KDS | orderId, itemId, state |
| `order.cancelled` | server → KDS | id, reason |
| `bump` | KDS → server | orderId or itemId |
| `recall` | KDS → server | orderId (undo bump within 30s) |

Heartbeat every 10s; on disconnect, banner appears and last 50 orders cached locally to keep operational view alive.

## 6. SLA & Performance Goals

| Metric | Target |
|---|---|
| New order render latency (server emit → on-screen) | <2s P95 |
| Bump action → server ack | <500ms P95 |
| Cards on screen | up to 60 without jank |
| Cold start | <3s |

## 7. UX Details

- **No login screens** — KDS is a station device; auth via device token issued at provisioning.
- **Big tap targets** — designed for gloved hands or bump bars.
- **Auto-archive** completed orders after 5 min; tap "history" to retrieve.
- **Recall** (undo) for accidental bumps within 30s.
- **Manager PIN** required for cancelling an order from KDS.

## 8. Recovery

- If realtime disconnects, KDS polls REST every 10s for changes since last cursor.
- All actions queued locally and replayed on reconnect (similar to POS outbox, much simpler).
- Stale check: if no event in 60s on a busy branch, surface "Stale view — investigating" banner.

## 9. Observability

- Per-card timer overlay shows production time; aggregated KPI bar at top (avg prep, items waiting, longest wait).
- Local app reports performance metrics + connectivity to backend; surfaced in admin dashboard.

## 10. Multi-Branch Scaling

Each branch operates its own KDS displays. A regional manager view aggregates queue depth + average prep time across branches (admin portal embeds same data).
