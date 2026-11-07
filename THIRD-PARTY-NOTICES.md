# Сторонние компоненты

## uiohook-napi 1.5.5

N-API bindings для libuiohook. MIT License, Copyright (c) 2020 Alexander Drozdov.
Полный текст: [third-party-licenses/uiohook-napi-MIT.txt](third-party-licenses/uiohook-napi-MIT.txt).

## libuiohook

Библиотека, встроенная в uiohook-napi. GNU LGPL v3.
Полный текст: [third-party-licenses/libuiohook-LGPL-3.0.txt](third-party-licenses/libuiohook-LGPL-3.0.txt).
Исходники поставляются в npm-пакете uiohook-napi; в упакованном приложении нативные файлы находятся
в `resources/app.asar.unpacked/node_modules/uiohook-napi/`.

## Koffi 2.15.2

FFI-библиотека для вызова Win32 API. MIT License.
Полный текст: [third-party-licenses/koffi-MIT.txt](third-party-licenses/koffi-MIT.txt).

## Использование

`uiohook-napi` применяется только для отправки одной последовательности `Ctrl+C` по хоткею.
`koffi` — для проверки активного окна игры через Win32 `GetForegroundWindow`,
`GetWindowThreadProcessId`, `QueryFullProcessImageNameW` и `GetAsyncKeyState`.
Глобальный hook не запускается; ввод в другие приложения не автоматизируется.
