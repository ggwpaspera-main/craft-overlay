export {};

declare global {
  interface Window {
    craft: {
      readClipboard(): Promise<string>;
      writeClipboard(text: string): Promise<void>;
      hideOverlay(): void;
      quitApp(): void;
      moveOverlay(dx: number, dy: number): void;
      onCapture(callback: (text: string | null) => void): () => void;
    };
  }
}
