import { CHAT_OVERHEAD_MS } from "@runic/shared";
import * as THREE from "three";
import { camera } from "./scene.ts";

const HEAD_HEIGHT = 1.25;
const point = new THREE.Vector3();

/** The HTML over a player's head: their username, and whatever they just said. */
export class Overhead {
  private element = document.createElement("div");
  private said = document.createElement("div");
  private clearSaid?: ReturnType<typeof setTimeout>;

  constructor(username: string) {
    const name = document.createElement("div");
    name.textContent = username;
    this.said.className = "said";
    this.element.append(this.said, name);
    document.getElementById("overheads")!.append(this.element);
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
  place({ x, z }: THREE.Vector3) {
    point.set(x, HEAD_HEIGHT, z).project(camera);
    const left = ((point.x + 1) / 2) * innerWidth;
    const top = ((1 - point.y) / 2) * innerHeight;
    this.element.style.transform = `translate(${left}px, ${top}px) translate(-50%, -100%)`;
  }

  remove() {
    clearTimeout(this.clearSaid);
    this.element.remove();
  }
}
