# A fixed 300 ms server tick, with actions timed in whole ticks

The server simulates the world in fixed 300 ms ticks. Every move, swing, pick and timer is counted in whole ticks, and the server sends clients exactly one state patch per tick. The classic slow, stepped feel comes from the action timings (a tile every 2 ticks, a swing every 8 ticks), not from the tick itself. A 600 ms tick, one tile per tick, gave that feel but left only coarse 0.6 s steps for tuning, such as Foraging speed-ups, and up to 0.6 s of input delay. Changing the tick later means rescaling every tick count in the game, so it is fixed here.

## Consequences

- Walking is one tile every 2 ticks (600 ms per tile). A one-tile-per-tick run stays possible.
- Clients slide each move over 600 ms and do no prediction, so an input takes up to one tick (300 ms) to show.
- Colyseus: `setFixedTimestep(step, 1000/300)`, `patchRate = null`, and one `broadcastPatch()` per tick.
