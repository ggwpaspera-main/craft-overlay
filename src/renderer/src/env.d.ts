export {};

declare global {
  interface Window {
    craft: {
      readClipboard(): Promise<string>;
      writeClipboard(text: string): Promise<void>;
      onHotkey(callback: () => void): () => void;
    };
  }
}
