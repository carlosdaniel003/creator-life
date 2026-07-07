export {};

declare global {
  interface Document {
    getElementById(elementId: string): HTMLElement;
  }
}
