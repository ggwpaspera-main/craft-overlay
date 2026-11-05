export {};

declare global {
  interface Window {
    craft: {
      readClipboard(): Promise<string>;
      writeClipboard(text: string): Promise<void>;
      onCapture(callback: (text: string | null) => void): () => void;
    };
  }
}
