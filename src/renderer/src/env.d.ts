export {};

declare global {
  interface Window {
    craft: {
      readClipboard(): Promise<string>;
      writeClipboard(text: string): Promise<void>;
      hideOverlay(): void;
      quitApp(): void;
      moveOverlay(dx: number, dy: number): void;
      setGoalVisible(visible: boolean): void;
      setGoalExpanded(expanded: boolean): void;
      moveGoal(dx: number, dy: number): void;
      hideGoal(): void;
      onCapture(callback: (text: string | null) => void): () => void;
    };
  }
}
