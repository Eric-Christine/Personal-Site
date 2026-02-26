(function () {
  "use strict";

  const STYLE_ID = "mario-easter-egg-style";

  const state = {
    controller: null,
    refs: null,
  };

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-mario-shell][hidden] { display: none !important; }
      [data-mario-shell].is-visible { display: block; }
      .mario-egg-fallback-trigger {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 9999;
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        font: 600 14px/1.2 "Trebuchet MS", "Segoe UI", sans-serif;
        color: #fff;
        background: linear-gradient(135deg, #c50f07, #f2711c);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        cursor: pointer;
      }
      .mario-egg-fallback-trigger.is-ready {
        animation: mario-egg-pulse 1.4s ease-in-out infinite;
      }
      .mario-egg-fallback-hint {
        position: fixed;
        left: 12px;
        right: 12px;
        top: 12px;
        z-index: 9999;
        margin: 0 auto;
        width: fit-content;
        max-width: min(90vw, 540px);
        border-radius: 999px;
        padding: 8px 14px;
        font: 600 12px/1.3 "Trebuchet MS", "Segoe UI", sans-serif;
        color: #f6f8ff;
        background: rgba(11, 24, 45, 0.8);
        letter-spacing: 0.01em;
      }
      .mario-egg-fallback-shell {
        position: fixed;
        inset: 0;
        z-index: 9998;
        display: grid;
        place-items: center;
        padding: 16px;
        background: rgba(0, 0, 0, 0.68);
      }
      .mario-egg-fallback-card {
        width: min(96vw, 1040px);
        border-radius: 16px;
        padding: 12px;
        background: linear-gradient(180deg, #ecf9ff 0%, #c8ebff 100%);
        border: 3px solid #19305d;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
      }
      .mario-egg-fallback-topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font: 700 14px/1.2 "Trebuchet MS", "Segoe UI", sans-serif;
        color: #13284a;
      }
      .mario-egg-fallback-close {
        border: 0;
        border-radius: 999px;
        padding: 6px 10px;
        background: #19305d;
        color: #fff;
        font: 600 12px/1 "Trebuchet MS", "Segoe UI", sans-serif;
        cursor: pointer;
      }
      [data-mario-canvas] {
        width: 100%;
        height: auto;
        display: block;
        border-radius: 12px;
        border: 4px solid #19305d;
        image-rendering: pixelated;
        background: linear-gradient(180deg, #8ad9ff 0%, #f0fbff 100%);
      }
      @keyframes mario-egg-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.06); }
      }
    `;

    document.head.appendChild(style);
  }

  function resolveRefs() {
    const existingRoot = document.querySelector("[data-mario-egg]");

    if (existingRoot) {
      return {
        hint: existingRoot.querySelector("[data-mario-hint]"),
        launch: existingRoot.querySelector("[data-mario-trigger]"),
        shell: existingRoot.querySelector("[data-mario-shell]"),
        close: existingRoot.querySelector("[data-mario-close]"),
        canvas: existingRoot.querySelector("[data-mario-canvas]"),
      };
    }

    const hint = document.createElement("p");
    hint.className = "mario-egg-fallback-hint";
    hint.textContent = "404 easter egg active. Click Secret Level to play.";

    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "mario-egg-fallback-trigger";
    launch.textContent = "Secret Level";

    const shell = document.createElement("section");
    shell.setAttribute("data-mario-shell", "");
    shell.className = "mario-egg-fallback-shell";
    shell.hidden = true;

    const card = document.createElement("div");
    card.className = "mario-egg-fallback-card";

    const topbar = document.createElement("div");
    topbar.className = "mario-egg-fallback-topbar";
    topbar.textContent = "404 Secret Stage";

    const close = document.createElement("button");
    close.type = "button";
    close.className = "mario-egg-fallback-close";
    close.textContent = "Close";

    const canvas = document.createElement("canvas");
    canvas.setAttribute("data-mario-canvas", "");
    canvas.setAttribute("width", "960");
    canvas.setAttribute("height", "540");
    canvas.setAttribute("aria-label", "Mario-style side-scroller game");

    topbar.appendChild(close);
    card.appendChild(topbar);
    card.appendChild(canvas);
    shell.appendChild(card);

    document.body.appendChild(hint);
    document.body.appendChild(launch);
    document.body.appendChild(shell);

    return { hint, launch, shell, close, canvas };
  }

  function setHint(message) {
    if (!state.refs || !state.refs.hint) {
      return;
    }
    state.refs.hint.textContent = message;
  }

  function ensureController() {
    if (state.controller || !state.refs || !state.refs.canvas) {
      return;
    }

    if (typeof window.initMarioSideScroller !== "function") {
      return;
    }

    state.controller = window.initMarioSideScroller(state.refs.canvas);
  }

  function openGame() {
    ensureController();
    if (!state.refs || !state.refs.shell) {
      return;
    }

    state.refs.shell.hidden = false;
    state.refs.shell.classList.add("is-visible");
    if (state.controller && typeof state.controller.setInputEnabled === "function") {
      state.controller.setInputEnabled(true);
    }

    if (state.refs.canvas) {
      state.refs.canvas.focus();
    }
  }

  function closeGame() {
    if (!state.refs || !state.refs.shell) {
      return;
    }

    state.refs.shell.classList.remove("is-visible");
    state.refs.shell.hidden = true;

    if (state.controller && typeof state.controller.setInputEnabled === "function") {
      state.controller.setInputEnabled(false);
    }
  }

  function init() {
    ensureStyles();
    state.refs = resolveRefs();

    if (!state.refs || !state.refs.canvas) {
      return;
    }

    if (state.controller && typeof state.controller.setInputEnabled === "function") {
      state.controller.setInputEnabled(false);
    }

    setHint("Click Secret Level to play. Press Enter in the game to start.");

    if (state.refs.launch) {
      state.refs.launch.classList.add("is-ready");
      state.refs.launch.addEventListener("click", () => {
        setHint("Secret level open. Press Enter in the game to start.");
        openGame();
      });
    }

    if (state.refs.close) {
      state.refs.close.addEventListener("click", closeGame);
    }

    document.addEventListener("keydown", (event) => {
      if (event.code === "Escape" && state.refs && state.refs.shell && !state.refs.shell.hidden) {
        closeGame();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
