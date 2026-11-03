# A three.js client with a fixed isometric camera, not Phaser 4

The client draws the world in real 3D with three.js, through a fixed isometric orthographic camera, using low-poly, flat-shaded models. It replaces open-source Phaser 4, which the effort started with. Our art now comes as 3D models (`.glb`) from Phaser AE's 3D Models tool, and three.js loads them as they are, lights them all the same way, and puts nearer things in front of farther things by itself. We ruled out keeping Phaser 4 and pre-rendering each model to 8-direction sprites: every new model or pose would need a re-render step, and props and slopes would need hand-sorted drawing order. A straight-down top-down camera was ruled out because a 3D figure seen from above reads as a blob.

## Consequences

- The UI (chat, inventory, skills) is HTML over the canvas, not drawn in the engine.
- Tiles are 1 world unit; tile (x, y) sits at world (x, 0, y), and clicks pick a tile by casting a ray onto the ground plane.
- AE's 3D tool makes static meshes only, so moving and fighting need rigging done elsewhere, or no rig at all.
- The server side (Colyseus, the tick, saving) is unchanged.
