/**
 * PROTOTYPE, throwaway: how ground items look (ticket "How do ground items look in the client?").
 * Three variants of fake ground items near the respawn tile, switchable via `?groundItems=A|B|C`
 * and the bar at the bottom (or keys 1/2/3). R toggles the owner-window ring. Nothing talks to the server.
 */
import * as THREE from "three";
import { iconUrl, itemName } from "./itemIcons.ts";
import { camera, renderer, scene } from "./scene.ts";

type Fake = { id: string; count?: number; mine: boolean; ownerWindow: boolean };
const SCENARIO: { dx: number; dy: number; items: Fake[]; note: string }[] = [
  {
    dx: 2,
    dy: 0,
    note: "your drop, owner minute",
    items: [{ id: "copperOre", count: 12, mine: true, ownerWindow: true }],
  },
  {
    dx: 0,
    dy: 2,
    note: "someone's drop, now public",
    items: [{ id: "ironSword", mine: false, ownerWindow: false }],
  },
  {
    dx: 2,
    dy: 2,
    note: "pile of 5",
    items: [
      { id: "berry", count: 7, mine: true, ownerWindow: true },
      { id: "ironHelmet", mine: false, ownerWindow: false },
      { id: "copperBar", count: 3, mine: false, ownerWindow: false },
      { id: "emberbone", mine: true, ownerWindow: false },
      { id: "herb", count: 20, mine: false, ownerWindow: false },
    ],
  },
  {
    dx: -2,
    dy: 1,
    note: "loot pile (death drop)",
    items: [
      "copperSword",
      "copperShield",
      "copperHelmet",
      "copperChestplate",
      "copperLeggings",
      "pickaxe",
      "ironOre",
      "berry",
      "berry",
    ].map((id) => ({ id, mine: true, ownerWindow: true })),
  },
];

const VARIANTS = {
  A: "Standing icons",
  B: "Icons flat on the ground",
  C: "One sack per tile",
} as const;
type Variant = keyof typeof VARIANTS;

const loader = new THREE.TextureLoader();
const textures = new Map<string, THREE.Texture>();
const texture = (id: string) => {
  if (!textures.has(id)) {
    const t = loader.load(iconUrl(id));
    t.colorSpace = THREE.SRGBColorSpace;
    textures.set(id, t);
  }
  return textures.get(id)!;
};

// Small jitter inside a tile so a pile's items don't sit exactly on top of each other.
const spots = [
  [0, 0],
  [-0.22, 0.15],
  [0.2, -0.18],
  [0.18, 0.22],
  [-0.2, -0.2],
  [0, 0.28],
  [0.3, 0],
  [-0.3, 0.02],
  [0, -0.3],
] as const;

function standingIcons(items: Fake[]) {
  const group = new THREE.Group();
  items.forEach((item, i) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture(item.id) }),
    );
    const [sx, sz] = spots[i % spots.length]!;
    sprite.scale.setScalar(items.length > 1 ? 0.42 : 0.5);
    sprite.position.set(sx, sprite.scale.y / 2, sz);
    sprite.renderOrder = i;
    group.add(sprite);
  });
  return group;
}

function flatIcons(items: Fake[]) {
  const group = new THREE.Group();
  const shape = new THREE.PlaneGeometry(0.55, 0.55).rotateX(-Math.PI / 2);
  items.forEach((item, i) => {
    const plane = new THREE.Mesh(
      shape,
      new THREE.MeshBasicMaterial({
        map: texture(item.id),
        transparent: true,
        alphaTest: 0.3,
      }),
    );
    const [sx, sz] = spots[i % spots.length]!;
    plane.position.set(sx, 0.02 + i * 0.002, sz);
    plane.rotation.y = (i * 1.3) % (Math.PI * 2);
    group.add(plane);
  });
  return group;
}

const sackMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a6a3e,
  roughness: 1,
});
const tieMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a3420,
  roughness: 1,
});
function sack(items: Fake[]) {
  const group = new THREE.Group();
  const size = items.length > 1 ? 0.3 : 0.22;
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 12),
    sackMaterial,
  );
  body.scale.y = 0.8;
  body.position.y = size * 0.75;
  body.castShadow = true;
  const neck = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.45, size * 0.7, 10),
    tieMaterial,
  );
  neck.position.y = size * 1.55;
  group.add(body, neck);
  // A single item shows its icon on the sack, so one thing on a tile still reads as that thing.
  if (items.length === 1) {
    const icon = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture(items[0]!.id) }),
    );
    icon.scale.setScalar(0.32);
    icon.position.y = size * 2.4;
    group.add(icon);
  }
  return group;
}

const ringShape = new THREE.RingGeometry(0.36, 0.44, 32).rotateX(-Math.PI / 2);
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xffd34d,
  transparent: true,
  opacity: 0.7,
});

export function showGroundItemsPrototype(origin: { x: number; y: number }) {
  const params = new URLSearchParams(location.search);
  let variant = (params.get("groundItems") ?? "A") as Variant;
  if (!(variant in VARIANTS)) variant = "A";
  let rings = true;

  const root = new THREE.Group();
  scene.add(root);
  const tiles: {
    group: THREE.Group;
    items: Fake[];
    note: string;
    ring: THREE.Mesh;
  }[] = [];

  const label = document.createElement("div");
  label.style.cssText =
    "position:fixed;pointer-events:none;color:#fff;font:12px system-ui;text-shadow:0 0 3px #000;white-space:pre;transform:translate(-50%,-100%);display:none";
  document.body.append(label);
  const said = document.createElement("div");
  said.style.cssText =
    "position:fixed;top:30px;left:8px;color:#ffe066;font:13px system-ui;text-shadow:0 0 3px #000";
  document.body.append(said);

  function build() {
    root.clear();
    tiles.length = 0;
    for (const { dx, dy, items, note } of SCENARIO) {
      const make =
        variant === "A" ? standingIcons : variant === "B" ? flatIcons : sack;
      const group = make(items);
      group.position.set(origin.x + dx, 0, origin.y + dy);
      const ring = new THREE.Mesh(ringShape, ringMaterial);
      ring.position.y = 0.015;
      ring.visible =
        rings && items.some((item) => item.mine && item.ownerWindow);
      group.add(ring);
      root.add(group);
      tiles.push({ group, items, note, ring });
    }
    bar.querySelector("span")!.textContent =
      `${variant} (${VARIANTS[variant]})${rings ? "" : " · no ring"}`;
    history.replaceState(null, "", `?groundItems=${variant}`);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // A tile-sized hit box per tile, like the real gathering sites, so a click on the tile catches the items.
  const hitShape = new THREE.BoxGeometry(1, 0.6, 1);
  const unseen = new THREE.MeshBasicMaterial({ visible: false });
  const tileUnder = (event: MouseEvent) => {
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const boxes = tiles.map((tile) => {
      const box = new THREE.Mesh(hitShape, unseen);
      box.position.copy(tile.group.position).setY(0.3);
      box.updateMatrixWorld();
      return box;
    });
    const hit = raycaster.intersectObjects(boxes)[0];
    return hit && tiles[boxes.indexOf(hit.object as (typeof boxes)[number])];
  };
  const describe = (item: Fake) =>
    `${itemName(item.id)}${item.count ? ` (${item.count})` : ""}${item.mine && item.ownerWindow ? "  · yours for now" : ""}`;

  let hovered: (typeof tiles)[number] | undefined;
  renderer.domElement.addEventListener("pointermove", (event) => {
    const tile = tileUnder(event);
    if (hovered && hovered !== tile) hovered.group.scale.setScalar(1);
    hovered = tile;
    if (!tile) {
      label.style.display = "none";
      return;
    }
    tile.group.scale.setScalar(1.15);
    label.textContent =
      tile.items.length === 1
        ? `Take ${describe(tile.items[0]!)}`
        : `Pile: ${tile.items.length} items\n${tile.items.map(describe).join("\n")}`;
    label.style.left = `${event.clientX}px`;
    label.style.top = `${event.clientY - 14}px`;
    label.style.display = "block";
  });
  renderer.domElement.addEventListener("click", (event) => {
    const tile = tileUnder(event);
    if (!tile) return;
    said.textContent =
      tile.items.length === 1
        ? `[prototype] would walk there and take ${describe(tile.items[0]!)} (${tile.note})`
        : `[prototype] would walk there and open the pile window, ${tile.items.length} rows (${tile.note})`;
  });

  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;bottom:70px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:6px 12px;border-radius:20px;background:#ff3d7f;color:#fff;font:600 13px system-ui;box-shadow:0 2px 8px #0008;z-index:10";
  const keys = Object.keys(VARIANTS) as Variant[];
  const step = (by: number) => {
    variant = keys[(keys.indexOf(variant) + by + keys.length) % keys.length]!;
    build();
  };
  const arrow = (text: string, by: number) => {
    const button = document.createElement("button");
    button.textContent = text;
    button.onclick = () => step(by);
    return button;
  };
  bar.append(arrow("◀", -1), document.createElement("span"), arrow("▶", 1));
  document.body.append(bar);
  addEventListener("keydown", (event) => {
    if (
      (event.target as HTMLElement).closest(
        "input, textarea, [contenteditable]",
      )
    )
      return;
    if (["1", "2", "3"].includes(event.key)) {
      variant = keys[Number(event.key) - 1]!;
      build();
    } else if (event.key === "r" || event.key === "R") {
      rings = !rings;
      build();
    }
  });

  build();
}
