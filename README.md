Top-Down Restaurant Game (placeholder sprites)

Overview
- A small 2D top-down restaurant prototype using Phaser 3.
- Walk to tables to take orders, go to the kitchen to cook, then deliver food for money.
- Money can be spent to upgrade oven speed.
- All sprites are placeholders drawn by code; replace them later with your graphics.

New features added:
- Customers have patience: if you take too long they may leave (small money penalty).
- Persistent save using `localStorage` (money, oven speed) with auto-save.
- Upgrade cost scales with current oven speed; UI shows dynamic cost.

Run locally
- Easiest: open `index.html` in a browser (some browsers restrict file loading).
- Prefer running a local server. From PowerShell in the `game` folder:

```powershell
# Python 3 built-in server
python -m http.server 8000; # then open http://localhost:8000
```

Important: do NOT open `index.html` directly with the `file://` protocol in Chrome-based browsers when you have local image assets (like `assets/dude.png`). Chrome blocks loading local files from file:// due to CORS/security and you'll see errors like:

	"Access to XMLHttpRequest at 'file:///.../assets/dude.png' from origin 'null' has been blocked by CORS policy"

Using a local HTTP server (the `python -m http.server` command above) serves files over `http://localhost:8000` and avoids these CORS errors. If you prefer, you can also use `Live Server` in VS Code or `npx http-server` (Node.js).

Controls
- Move: Arrow keys
- Interact: `E` to take orders, cook at kitchen, and deliver food.

Files
- `index.html` - game container and simple UI
- `src/main.js` - game logic (Phaser 3)

Next steps you might want me to do
- Replace placeholders with your supplied sprites
- Add animations, sound, and more upgrade options
- Add persistence (save money/levels)

