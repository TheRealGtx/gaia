export class PriorityQueue<T> {
  private entries: Array<{ value: T; priority: readonly [number, number] }> = [];

  push(value: T, priority: readonly [number, number]): void {
    this.entries.push({ value, priority });
    this.entries.sort((a, b) => a.priority[0] - b.priority[0] || a.priority[1] - b.priority[1]);
  }

  pop(): T | undefined {
    return this.entries.shift()?.value;
  }

  get size(): number {
    return this.entries.length;
  }
}
