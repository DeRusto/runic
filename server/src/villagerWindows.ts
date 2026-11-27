import {
  choicesNodeOf,
  nodesOf,
  offers,
  VILLAGERS,
  type DialogueAction,
  type VillagerId,
} from "@runic/shared";
import { tilesNextTo } from "./pathfinding.ts";
import type { QueuedAction } from "./playerActions.ts";
import type { Quests } from "./quests.ts";
import type { World } from "./worldContext.ts";

/** What opens and closes each kind of villager window, and what a hit makes the villager do. */
const WINDOWS = {
  talk: { closed: "talkEnded", hit: "stops talking" },
  store: { opened: "storeOpened", closed: "storeClosed", hit: "stops trading" },
  bank: { opened: "bankOpened", closed: "bankClosed", hit: "shuts the bank" },
} as const;
type VillagerWindow = keyof typeof WINDOWS;

/** Villagers' windows: a conversation, the store or the bank, open while the player stays beside the villager (village spec §2). */
export class VillagerWindows {
  /**
   * Each player's open villager window, the villager they must stay beside, and for a
   * conversation the node whose choices they can pick from, if any. A player has at most one.
   */
  private windows = new Map<
    string,
    { kind: VillagerWindow; villager: VillagerId; node?: string }
  >();
  /** What each choice's action but a quest's does, with the villager who offered it; the choice has already been checked. A quest's runs in `choose`, where it decides where the talk moves to (#231). */
  private readonly dialogueActions: Record<
    Exclude<DialogueAction, "quest">,
    (id: string, villager: VillagerId) => void
  > = {
    giveTools: (id, villager) => this.quests.giveTools(id, villager),
    openStore: (id, villager) => this.openWindow(id, "store", villager),
    openBank: (id, villager) => this.openWindow(id, "bank", villager),
  };

  constructor(
    private readonly world: World,
    private readonly quests: Quests,
  ) {}

  /**
   * The visit a click asks for. Both come straight off the network, so a villager who isn't
   * standing in this region is ignored, as is a `then` their conversation doesn't offer.
   */
  visitIntent(villager: string, then?: string): QueuedAction | undefined {
    if (!this.world.villagers.has(villager as VillagerId)) return undefined;
    const visit = {
      kind: "visiting",
      villager: villager as VillagerId,
    } as const;
    if (then === undefined) return visit;
    if (!offers(visit.villager, then)) return undefined;
    return { ...visit, then: then as Exclude<DialogueAction, "quest"> };
  }

  /** A hit shuts the window; a blocked swing still hits, and only a miss leaves it open. */
  hit(id: string) {
    const open = this.windows.get(id);
    if (!open) return;
    const { name } = VILLAGERS[open.villager];
    this.shutWindow(id, `You're hit, and ${name} ${WINDOWS[open.kind].hit}.`);
  }

  /** The player left or dropped, so their window goes without a word. */
  forget(id: string) {
    this.windows.delete(id);
  }

  /** `choice` comes straight off the network, so anything but the index of one of the current choices is ignored, as is a player no longer beside the villager. */
  choose(id: string, choice: number) {
    if (!this.world.canAct(id)) return;
    const talk = this.windowOf(id, "talk");
    if (!talk?.node || !Number.isInteger(choice)) return;
    const picked = nodesOf(talk.villager)[talk.node]!.choices![choice];
    if (!picked || !this.beside(id, talk.villager)) return;
    // A quest choice is the server's check: a turn-in it refuses keeps the node, which the box shows again from its first line (#231).
    if (picked.action === "quest") {
      if (!this.quests.advanceQuest(id, talk.villager)) {
        this.moveTalk(id, talk.villager, talk.node);
        return;
      }
      this.moveTalk(id, talk.villager, picked.to);
      return;
    }
    this.moveTalk(id, talk.villager, picked.to);
    if (picked.action) this.dialogueActions[picked.action](id, talk.villager);
  }

  /**
   * A conversation with no choices left stays open, with no node, until the box has shown its
   * last lines and sends endTalk, so walking away or a hit still closes the box.
   */
  private moveTalk(id: string, villager: VillagerId, node: string) {
    this.replaceWindow(id, "talk");
    this.world.events.push({ type: "talk", player: id, villager, node });
    this.windows.set(id, {
      kind: "talk",
      villager,
      node: choicesNodeOf(villager, node),
    });
  }

  /** Opens a store or bank window. */
  private openWindow(id: string, kind: "store" | "bank", villager: VillagerId) {
    this.replaceWindow(id, kind);
    this.windows.set(id, { kind, villager });
    this.world.events.push({ type: WINDOWS[kind].opened, player: id });
  }

  /** A window of another kind still open closes quietly, so the client shuts it (village spec §2). */
  private replaceWindow(id: string, kind: VillagerWindow) {
    const open = this.windows.get(id);
    if (open && open.kind !== kind)
      this.world.events.push({ type: WINDOWS[open.kind].closed, player: id });
  }

  /** The player's window, if it is of this kind. */
  windowOf(id: string, kind: VillagerWindow) {
    const open = this.windows.get(id);
    return open?.kind === kind ? open : undefined;
  }

  /** The player closed it, so walking away later says nothing. */
  close(id: string, kind: VillagerWindow) {
    if (this.windowOf(id, kind)) this.windows.delete(id);
  }

  /** Closes the player's window from the server's side, with the line saying why. */
  private shutWindow(id: string, line: string) {
    const open = this.windows.get(id);
    if (!open) return;
    this.windows.delete(id);
    this.world.events.push({ type: "told", player: id, line });
    this.world.events.push({ type: WINDOWS[open.kind].closed, player: id });
  }

  private beside(id: string, villager: VillagerId) {
    const player = this.world.state.players.get(id)!;
    return tilesNextTo(
      this.world.tiles,
      this.world.villagers.get(villager)!,
    ).some(({ x, y }) => x === player.x && y === player.y);
  }

  /** After the steps, so a conversation opens on the tick of arrival, and one walked away from ends on the tick of the step. */
  advanceVisits() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "visiting" || unsynced.path.length) continue;
      unsynced.action = undefined;
      if (action.then) this.dialogueActions[action.then](id, action.villager);
      else
        this.moveTalk(
          id,
          action.villager,
          this.quests.openingNode(id, action.villager),
        );
    }
    for (const [id, { villager }] of this.windows) {
      if (!this.beside(id, villager))
        this.shutWindow(id, `You walk away from ${VILLAGERS[villager].name}.`);
    }
  }
}
