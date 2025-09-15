export function logNever(value: never): void {
  console.error(`Unexpected value: ${value}`);
}

export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
