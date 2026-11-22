import {
  CROSS_INTENT,
  OBSTACLES,
  GATHERING,
  offers,
  gatherRefusal,
  PICKPOCKET_INTENT,
  PICKPOCKETS,
  pickpocketRefusal,
  STEAL_INTENT,
  stallRefusal,
  OPEN_INTENT,
  strongboxRefusal,
  stationRefusal,
  TAKE_INTENT,
  TARGET_INTENT,
  TICK_MS,
  VISIT_INTENT,
  WALK_INTENT,
  type DialogueAction,
  isPickpocketTarget,
  type PickpocketTarget,
  type StallKind,
  type StrongboxKind,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import { printChatLine } from "./bottomBar.ts";
import type { showGatheringSites } from "./gatheringSites.ts";
import type { showGroundItems } from "./groundItemSacks.ts";
import type { showPileWindow } from "./pileWindow.ts";
import type { OpenMenu } from "./characterSheet.ts";
import { playerMenuChoices } from "./playerMenu.ts";
import type { showPlayers, WorldConnection } from "./players.ts";
import { camera, renderer, scene } from "./scene.ts";
import type { showEnemies } from "./enemies.ts";
import type { showFires } from "./fires.ts";
import type { showSmithingPanel } from "./smithingPanel.ts";
import { stationTile, type addStations } from "./stations.ts";
import type { addMarks } from "./marks.ts";
import type { addStalls } from "./stalls.ts";
import type { addObstacles } from "./obstacles.ts";
import type { addStrongboxes } from "./strongboxes.ts";
import type { addVillagers } from "./villagers.ts";

const MARKER_MS = 2 * TICK_MS;

/**
 * Targets what is under a click or walks to the ground tile. Right-click opens the choices for
 * villagers, marks, stalls, strongboxes, obstacles and other players.
 */
export function walkOnClick(
  room: WorldConnection,
  tiles: TileKind[][],
  enemyUnder: ReturnType<typeof showEnemies>,
  siteUnder: ReturnType<typeof showGatheringSites>,
  stationUnder: ReturnType<typeof addStations>,
  fireUnder: ReturnType<typeof showFires>,
  openSmithingPanel: ReturnType<typeof showSmithingPanel>,
  villagerUnder: Awaited<ReturnType<typeof addVillagers>>,
  markUnder: Awaited<ReturnType<typeof addMarks>>,
  stallUnder: Awaited<ReturnType<typeof addStalls>>["stallUnder"],
  strongboxUnder: ReturnType<typeof addStrongboxes>["strongboxUnder"],
  obstacleUnder: ReturnType<typeof addObstacles>,
  groundItemUnder: ReturnType<typeof showGroundItems>,
  openPileWindow: ReturnType<typeof showPileWindow>,
  otherPlayerUnder: ReturnType<typeof showPlayers>["otherPlayerUnder"],
  openMenu: OpenMenu,
) {
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }),
  );
  marker.visible = false;
  scene.add(marker);
  let hideMarker: ReturnType<typeof setTimeout>;
  const showMarker = (x: number, y: number) => {
    marker.position.set(x, 0.02, y);
    marker.visible = true;
    clearTimeout(hideMarker);
    hideMarker = setTimeout(() => (marker.visible = false), MARKER_MS);
  };

  /**
   * One Thieving attempt on a target at (x, y): `refusal` says why the rules refuse it, which the
   * chat shows instead of sending the intent.
   */
  const thieve = (
    refusal: (thievingXp: number) => string | undefined,
    send: () => void,
    x: number,
    y: number,
  ) => {
    const me = room.state.players.get(room.sessionId);
    if (!me) return;
    const refused = refusal(me.thievingXp);
    if (refused) return printChatLine(refused);
    showMarker(x, y);
    send();
  };

  /** Pickpockets a mark or villager (#250, #251). */
  const pickpocket = (target: PickpocketTarget, x: number, y: number) =>
    thieve(
      (xp) => pickpocketRefusal(PICKPOCKETS[target], xp),
      () => room.send(PICKPOCKET_INTENT, target),
      x,
      y,
    );

  /** Steals from one of Marta's stalls (#252). */
  const steal = (stall: StallKind, x: number, y: number) =>
    thieve(
      (xp) => stallRefusal(stall, xp),
      () => room.send(STEAL_INTENT, stall),
      x,
      y,
    );

  /** Opens a strongbox (#253). */
  const openStrongbox = (strongbox: StrongboxKind, x: number, y: number) =>
    thieve(
      (xp) => strongboxRefusal(strongbox, xp),
      () => room.send(OPEN_INTENT, strongbox),
      x,
      y,
    );

  const crossing = () =>
    room.state.players.get(room.sessionId)?.action === "crossing";

  const cross = ({
    obstacle,
    x,
    y,
  }: NonNullable<ReturnType<typeof obstacleUnder>>) => {
    if (crossing()) return;
    showMarker(x, y);
    room.send(CROSS_INTENT, obstacle);
  };

  const aim = (event: MouseEvent) => {
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  };

  // The browser's own menu never shows on the canvas, whatever is under the click.
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    if (crossing()) return;
    aim(event);
    const villager = villagerUnder(raycaster);
    if (villager) {
      const visit = (then?: DialogueAction) => () => {
        showMarker(villager.x, villager.y);
        room.send(VISIT_INTENT, { villager: villager.villager, then });
      };
      const { villager: id, x, y } = villager;
      return openMenu(event, [
        ["Talk-to", visit()],
        ...(offers(villager.villager, "openStore")
          ? ([["Trade", visit("openStore")]] as const)
          : []),
        ...(offers(villager.villager, "openBank")
          ? ([["Bank", visit("openBank")]] as const)
          : []),
        ...(isPickpocketTarget(id)
          ? ([["Pickpocket", () => pickpocket(id, x, y)]] as const)
          : []),
      ]);
    }
    const mark = markUnder(raycaster);
    if (mark)
      return openMenu(event, [
        ["Pickpocket", () => pickpocket(mark.mark, mark.x, mark.y)],
      ]);
    const stall = stallUnder(raycaster);
    if (stall)
      return openMenu(event, [
        ["Steal-from", () => steal(stall.stall, stall.x, stall.y)],
      ]);
    const strongbox = strongboxUnder(raycaster);
    if (strongbox)
      return openMenu(event, [
        [
          "Open",
          () => openStrongbox(strongbox.strongbox, strongbox.x, strongbox.y),
        ],
      ]);
    const obstacle = obstacleUnder(raycaster);
    if (obstacle)
      return openMenu(event, [
        [
          `Cross ${OBSTACLES[obstacle.obstacle].name.toLowerCase()}`,
          () => cross(obstacle),
        ],
      ]);
    const id = otherPlayerUnder(raycaster);
    if (id) openMenu(event, [...playerMenuChoices(room, id)]);
  };

  const onClick = (event: MouseEvent) => {
    if (crossing()) return;
    aim(event);
    const enemy = enemyUnder(raycaster);
    if (enemy) {
      showMarker(enemy.tile.x, enemy.tile.y);
      room.send(TARGET_INTENT, enemy.id);
      return;
    }
    const groundItem = groundItemUnder(raycaster);
    if (groundItem) {
      showMarker(groundItem.x, groundItem.y);
      if (groundItem.ids.length > 1) openPileWindow(groundItem);
      else room.send(TAKE_INTENT, groundItem.ids[0]);
      return;
    }
    const site = siteUnder(raycaster);
    const me = room.state.players.get(room.sessionId);
    if (site && me) {
      const refusal = gatherRefusal(site.skill, site.kind, site.left(), me);
      if (refusal) {
        printChatLine(refusal);
      } else {
        showMarker(site.x, site.y);
        room.send(GATHERING[site.skill].intent, site.id);
      }
      return;
    }
    const station = stationUnder(raycaster);
    if (station && me) {
      const refusal = stationRefusal(station, me);
      if (refusal) {
        printChatLine(refusal);
      } else {
        const { x, y } = stationTile(station, me);
        showMarker(x, y);
        openSmithingPanel(station);
      }
      return;
    }
    const stall = stallUnder(raycaster);
    if (stall) return steal(stall.stall, stall.x, stall.y);
    const strongbox = strongboxUnder(raycaster);
    if (strongbox)
      return openStrongbox(strongbox.strongbox, strongbox.x, strongbox.y);
    const obstacle = obstacleUnder(raycaster);
    if (obstacle) return cross(obstacle);
    const fire = fireUnder(raycaster);
    if (fire && me) {
      showMarker(fire.x, fire.y);
      openSmithingPanel("fire", { x: fire.x, y: fire.y });
      return;
    }
    const villager = villagerUnder(raycaster);
    if (villager) {
      showMarker(villager.x, villager.y);
      room.send(VISIT_INTENT, { villager: villager.villager });
      return;
    }
    const mark = markUnder(raycaster);
    if (mark) return pickpocket(mark.mark, mark.x, mark.y);
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const x = Math.round(hit.x);
    const y = Math.round(hit.z);
    if (!tiles[y]?.[x]) return;
    if (tiles[y][x].prop === "gate")
      return printChatLine("The gate is locked.");

    showMarker(x, y);
    room.send(WALK_INTENT, { x, y });
  };
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("contextmenu", onContextMenu);

  room.onLeave(() => {
    renderer.domElement.removeEventListener("click", onClick);
    renderer.domElement.removeEventListener("contextmenu", onContextMenu);
    clearTimeout(hideMarker);
    scene.remove(marker);
  });
}
