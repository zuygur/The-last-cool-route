# 42°C: The Last Cool Route

A browser-based 2D pixel-art game built with Phaser 3. Manage a Mediterranean neighborhood during an extreme heatwave.

## Quick Start

### Option 1: Python HTTP Server (Recommended)

```bash
cd last-cool-route
python -m http.server 8080
```

Then open your browser and navigate to:
```
http://localhost:8080
```

### Option 2: Node.js HTTP Server

```bash
cd last-cool-route
npx http-server -p 8080
```

Then open:
```
http://localhost:8080
```

### Option 3: Live Server (VS Code)

1. Install the "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"

## Game Features (Current Build)

### Implemented
- ✅ Main menu with start and continue flows
- ✅ Top-down neighborhood map with interactive locations and characters
- ✅ Click-to-select system with fixed information panel and camera-safe labels
- ✅ HUD with era, clock, speed, temperature, Eco Credits, events, climate, and time travel controls
- ✅ Free camera panning with mouse drag and keyboard controls
- ✅ 2016 planning and 2026 climate comparison gameplay
- ✅ Infrastructure placement with zone validation, cost checks, mission progress, and feedback
- ✅ Climate dashboard with indicators, history, and world-space heat map
- ✅ Climate events with preparation requirements and resident impact feedback
- ✅ Notification banner for builds, missions, saves, and climate warnings
- ✅ Local save/load with 15-second autosave and infrastructure restoration
- ✅ Responsive landscape layout and procedural pixel-art graphics
- ✅ ESC key support for closing active panels and placement mode

### Locations
1. **Meryem's Home** - Elderly resident (residential)
2. **Neighborhood School** - Potential cooling center (school)
3. **Central Hospital** - Medical facility (hospital)
4. **Sunrise Park** - Green space with natural cooling (park)
5. **Bus Stop** - Public transportation hub (bus stop)
6. **Cooling Center** - Safe air-conditioned space (cooling center)
7. **Energy Station** - Power generation (energy station)
8. **Elif's House** - Family residence (residential)

### Characters
- **Meryem** - Elderly resident needing shelter and water
- **Deniz** - Delivery worker with daily deliveries
- **Elif** - Mother caring for her family

## Project Structure

```
src/
├── main.js                 # Game config and initialization
├── assets/
│   └── graphics.js         # Placeholder asset generator
├── objects/
│   ├── HUD.js              # Heads-up display
│   ├── Location.js         # Clickable map location class
│   └── Character.js        # NPC character class
└── scenes/
    ├── MenuScene.js        # Main menu
    └── GameScene.js        # Gameplay scene
```

## Controls

- **Click** on locations and characters to view information
- **ESC** or click "Close" to close info panels
- **⚙️ Menu** button to return to main menu
- Mouse hover shows clickable highlights

## Phase 13 QA Status

- ✅ JavaScript syntax validation completed for all source files
- ✅ Local HTTP server smoke test returned HTTP 200
- ✅ Save/load paths include guarded localStorage access and version validation
- ✅ Existing Phaser scenes and script loading order remain intact
- ⚠️ Full browser interaction QA is pending because no Chromium/Chrome/Edge automation executable is available in the current environment
- ⚠️ Manual visual checks are still recommended for HUD buttons, dashboard controls, event preparation, save/continue, and camera panning

## Remaining Improvements

- [ ] Add automated browser interaction coverage when a browser driver is available
- [ ] Add audio effects and music
- [ ] Replace procedural placeholder graphics with final pixel art
- [ ] Add explicit game-over and win-state presentation
- [ ] Complete Turkish localization across gameplay text

## Technology Stack

- **Phaser 3.55.2** - Game framework (from CDN)
- **Vanilla JavaScript** - No build tools required
- **HTML5 Canvas** - Rendering
- **CSS3** - Styling and responsive layout

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (tested on landscape)

## Development Tips

- Edit any JavaScript file and refresh your browser to see changes
- Use `#debug` hash (`http://localhost:8080#debug`) for debug mode
- All graphics are procedurally generated - no external image files needed yet
- Phaser documentation: https://phaser.io/docs

## License

Created as a hackathon project - 2026
