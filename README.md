# Space Invaders

A classic Space Invaders-style arcade game built with vanilla HTML, CSS, and JavaScript.

## Controls

- **A / D** or **Arrow keys** - Move left/right
- **Space** - Shoot / Start game

## Setup (first time)

Generate sound files:

```bash
python3 create-sounds.py
```

## Run Instructions

**For iPhone/iPad:** You must use a local server—opening the file directly will not play sound.

1. From the project folder, run:
   ```bash
   python3 -m http.server 3000
   ```
2. On your phone (same Wi‑Fi), open `http://YOUR-COMPUTER-IP:3000` (e.g. `http://192.168.1.5:3000`)

**Desktop:** Double-click `index.html` or run the server and visit `http://localhost:3000`.
