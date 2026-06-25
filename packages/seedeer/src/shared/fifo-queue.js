/**
 * Simple FIFO queue with a head pointer instead of Array.shift(), so
 * dequeuing under steady load stays O(1) amortized instead of O(n).
 */
export class FifoQueue {
  #items = [];
  #head = 0;

  push(item) {
    this.#items.push(item);
  }

  shift() {
    if (this.#head >= this.#items.length) return undefined;
    const item = this.#items[this.#head];
    this.#items[this.#head] = undefined;
    this.#head += 1;
    if (this.#head > 1024 && this.#head * 2 > this.#items.length) {
      this.#items = this.#items.slice(this.#head);
      this.#head = 0;
    }
    return item;
  }

  get length() {
    return this.#items.length - this.#head;
  }
}
