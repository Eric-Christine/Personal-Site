Original prompt: integrate mario-side-scroller game into my 404 pages on my personal site, make it like an easter egg

## 2026-02-19
- Added reusable game runtime at `/games/mario-side-scroller.js` based on existing side-scroller logic.
- Added reusable easter-egg controller at `/games/mario-easter-egg.js`.
- Replaced root `404.html` with a custom 404 screen that includes hidden game shell markup and controls.
- Injected easter-egg scripts into `/projects/calculator/+not-found.html` so calculator 404 also supports the hidden game overlay.

TODOs / suggestions for next pass:
- Run a deploy-preview smoke test on Firebase hosting to confirm script paths resolve correctly in production.
- If you want harder discoverability, remove the explicit Konami hint text from root 404.
- JS syntax checks passed for `/games/mario-side-scroller.js` and `/games/mario-easter-egg.js`.
- Browser smoke test passed on `/404.html` (Konami unlock => game shell visible, no console errors).
- Browser smoke test passed on `/projects/calculator/+not-found.html` using fallback injection mode (trigger present, shell visible, no console errors).
- Tightened behavior: the visible trigger no longer unlocks by click; Konami sequence is now required before launch.
- Regression smoke test: on both 404 pages, `visibleAfterClick=false` and `visibleAfterCode=true`.
- Removed Konami requirement from easter egg flow; Secret Level button now launches immediately.
- Updated 404 hint copy to match click-to-launch behavior.
- Smoke test passed: button click opens game shell (`shellVisible=true`).
