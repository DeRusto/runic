import { CHAT_OVERHEAD_MS } from "@runic/shared";
import * as THREE from "three";
import { camera } from "./scene.ts";

const HEAD_HEIGHT = 1.25;
const point = new THREE.Vector3();

/** The HTML over a player's head: their username, a mark while any prayer is on, and whatever they just said. */
export class Overhead {
  private element = document.createElement("div");
  private said = document.createElement("div");
  private bar = document.createElement("div");
  private fill = document.createElement("i");
  private prayerMark = document.createElement("div");
  private clearSaid?: ReturnType<typeof setTimeout>;
  /** Blows the server has decided but the clips haven't reached yet, so the bar doesn't show them. */
  private pendingDamage = 0;

  constructor(username: string) {
    const name = document.createElement("div");
    name.textContent = username;
    this.said.className = "said";
    this.bar.className = "bar";
    this.bar.hidden = true;
    this.bar.append(this.fill);
    // A small glowing star; its look is the Prayer tab ticket's choice (Prayer spec §6).
    this.prayerMark.className = "prayer-mark";
    this.prayerMark.textContent = "✦";
    this.prayerMark.title = "Prayer on";
    this.prayerMark.hidden = true;
    this.element.append(this.said, this.bar, this.prayerMark, name);
    document.getElementById("overheads")!.append(this.element);
  }

  /** Call once a frame. The bar only shows below full health, and not once at 0. */
  showHealth(health: number, max: number) {
    const shown = health + this.pendingDamage;
    this.bar.hidden = shown >= max || shown <= 0;
    this.fill.style.width = `${(shown / max) * 100}%`;
  }

  /** Call once a frame: the mark shows while the player has any prayer on. */
  showPrayerMark(prayerOn: boolean) {
    this.prayerMark.hidden = !prayerOn;
  }

  /** Keeps a blow off the bar until `showBlow`, when its clip connects. */
  holdBlow(damage: number) {
    this.pendingDamage += damage;
  }

  showBlow(damage: number, critical = false) {
    this.pendingDamage -= damage;
    if (critical) this.pop(`${damage}!`, "damage critical");
    else this.pop(damage ? String(damage) : "miss", damage ? "damage" : "miss");
  }

  /** A number that floats up from here and fades; its look comes from `kind`'s CSS class. */
  pop(text: string, kind: string) {
    const number = document.createElement("div");
    number.className = `pop ${kind}`;
    number.textContent = text;
    number.onanimationend = () => number.remove();
    this.element.append(number);
  }

  /** Other players' words, so only ever textContent, never HTML. */
  say(text: string) {
    this.said.textContent = text;
    clearTimeout(this.clearSaid);
    this.clearSaid = setTimeout(
      () => (this.said.textContent = ""),
      CHAT_OVERHEAD_MS,
    );
  }

  /** Call once a frame, after the camera has moved. */
  place({ x, z }: THREE.Vector3, sizeMultiplier = 1) {
    point.set(x, HEAD_HEIGHT * sizeMultiplier, z).project(camera);
    const left = ((point.x + 1) / 2) * innerWidth;
    const top = ((1 - point.y) / 2) * innerHeight;
    this.element.style.transform = `translate(${left}px, ${top}px) translate(-50%, -100%)`;
  }

  remove() {
    clearTimeout(this.clearSaid);
    this.element.remove();
  }
}
