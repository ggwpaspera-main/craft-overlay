import * as koffi from 'koffi';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import { basename } from 'node:path';

export interface ForegroundSnapshot {
  hwnd: string;
  pid: number;
  processName: string;
  windowTitle: string;
}

export interface NativeInput {
  snapshot: () => ForegroundSnapshot | null;
  heldKeys: () => boolean;
  sendCtrlC: () => void;
}

/**
 * Отправка Ctrl+C и чтение foreground-окна без PowerShell.
 *
 * uiohook-napi используется только в режиме отправки (keyTap), без запуска
 * глобального hook. Koffi даёт узкий Win32-адаптер для проверки активного окна.
 */
export function createNativeInput(): NativeInput | null {
  if (process.platform !== 'win32') return null;

  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');
  const getForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()');
  const getWindowText = user32.func(
    'int __stdcall GetWindowTextW(void *window, _Out_ uint16_t *text, int maxCount)',
  );
  const getWindowThreadProcessId = user32.func(
    'uint32_t __stdcall GetWindowThreadProcessId(void *window, _Out_ uint32_t *pid)',
  );
  const getAsyncKeyState = user32.func('int16_t __stdcall GetAsyncKeyState(int key)');
  const openProcess = kernel32.func(
    'void * __stdcall OpenProcess(uint32_t access, int inherit, uint32_t pid)',
  );
  const queryFullProcessImageName = kernel32.func(
    'int __stdcall QueryFullProcessImageNameW(void *process, uint32_t flags, _Out_ uint16_t *image, _Inout_ uint32_t *size)',
  );
  const closeHandle = kernel32.func('int __stdcall CloseHandle(void *handle)');

  function snapshot(): ForegroundSnapshot | null {
    const window = getForegroundWindow();
    if (!window) return null;
    const pid = [0];
    if (!getWindowThreadProcessId(window, pid)) return null;
    const pidValue = pid[0];
    if (!pidValue) return null;
    const handle = openProcess(0x1000, 0, pidValue);
    if (!handle) return null;
    try {
      const image = Buffer.alloc(32768 * 2);
      const length = [32768];
      const ok = queryFullProcessImageName(handle, 0, image, length);
      const chars = length[0];
      if (!ok || chars === undefined || chars < 1) return null;
      const titleBuffer = Buffer.alloc(1024 * 2);
      const titleLength = getWindowText(window, titleBuffer, 1024);
      const windowTitle =
        titleLength > 0
          ? titleBuffer.toString('utf16le', 0, titleLength * 2)
          : '';
      return {
        hwnd: koffi.address(window).toString(),
        pid: pidValue,
        processName: basename(image.toString('utf16le', 0, chars * 2)),
        windowTitle,
      };
    } finally {
      closeHandle(handle);
    }
  }

  function heldKeys(): boolean {
    // Alt+F (наш хоткей), Ctrl/C (копирование), Shift/Win — не синтезируем keyup.
    return [0x11, 0x43, 0x10, 0x12, 0x46, 0x5b, 0x5c].some(
      (key) => (getAsyncKeyState(key) & 0x8000) !== 0,
    );
  }

  function sendCtrlC(): void {
    uIOhook.keyTap(UiohookKey.C, [UiohookKey.Ctrl]);
  }

  return { snapshot, heldKeys, sendCtrlC };
}
