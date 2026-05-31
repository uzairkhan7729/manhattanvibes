# Sequence — POS Offline Order + Sync

```
Cashier   POS UI    SyncEngine    Local SQLite    Internet     API       Mongo
   │         │           │              │             │          │          │
   │ add items, pay cash │              │             │          │          │
   ├────────►│           │              │             │          │          │
   │         │ create Op{ORDER_CREATE}  │             │          │          │
   │         ├──────────►│              │             │          │          │
   │         │           │ insert order+ outbox       │          │          │
   │         │           ├─────────────►│             │          │          │
   │         │  print receipt locally   │             │          │          │
   │         │           │              │             │          │          │
   │  ... internet down for 2h ...      │             │          │          │
   │         │           │ retries paused (degraded)  │          │          │
   │         │           │              │             │          │          │
   │  internet returns                                            │          │
   │         │           │ wake (timer)                            │          │
   │         │           │ GET /sync/changes?since=cur            │          │
   │         │           ├──────────────────────────────────────►│          │
   │         │           │◄──────────────────────────────────────┤          │
   │         │           │ apply deltas to local                  │          │
   │         │           │              │                          │          │
   │         │           │ POST /sync { ops:[op1..op50] }         │          │
   │         │           ├──────────────────────────────────────►│          │
   │         │           │                                         │ apply   │
   │         │           │                                         ├────────►│
   │         │           │ { applied:[op1..op49], conflict:[op50] }│          │
   │         │           │◄──────────────────────────────────────┤          │
   │         │           │ reconcile local ids, surface 1 conflict           │
   │         │           │              │                                     │
   │         │ sync banner: "Synced 49 / 1 needs manager review"             │
```
