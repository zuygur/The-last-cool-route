// HUD.js - Modern expanded top status bar with glassmorphism and clean element grouping

class HUD {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.elements = {};
    }

    create() {
        // Create HUD container at top of screen (Taller height: 70px for breathing room)
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000);
        this.container.setScrollFactor(0);

        // Modern semi-transparent background with blur styling (simulated via dark alpha rect)
        const bg = this.scene.add.rectangle(640, 35, 1280, 70, 0x0f172a, 0.95);
        bg.setScrollFactor(0);
        bg.setInteractive(); // Blocks clicks from reaching the game map behind it
        bg.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
        });
        this.container.add(bg);

        // --- LEFT GROUP: Era & Clock ---
        this.elements.eraText = this.scene.add.text(24, 23, '📅 2016 (Past)', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            fontStyle: 'bold'
        });
        this.elements.eraText.setScrollFactor(0);
        this.container.add(this.elements.eraText);

        this.elements.clockText = this.scene.add.text(180, 23, 'Day 1 — 08:00', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#f8fafc',
            fontStyle: 'bold'
        });
        this.elements.clockText.setScrollFactor(0);
        this.container.add(this.elements.clockText);

        // Speed Controls (1x, 2x, 4x) next to clock
        // Shift the speed controls left to give the resource and action groups room.
        this.createSpeedControls(340, 21);

        // --- MIDDLE GROUP: Temperature & Eco Credits (EC) ---
        this.elements.tempText = this.scene.add.text(470, 23, '🌡️ 34.0°C', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#fbbf24',
            fontStyle: 'bold'
        });
        this.elements.tempText.setScrollFactor(0);
        this.container.add(this.elements.tempText);
        this.layoutSpeedControls();

        this.elements.ecText = this.scene.add.text(590, 23, '🪙 200 EC', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#facc15',
            fontStyle: 'bold'
        });
        this.elements.ecText.setScrollFactor(0);
        this.container.add(this.elements.ecText);

        // --- RIGHT GROUP: Time Machine & Menu ---
        // Time Machine Button
        // Keep the wider Time Machine control clear of the Climate button.
        // Keep every top-bar control in its own non-overlapping slot.
        // The order is: Events, Time Machine, Climate, Menu.
        this.createEventsButton(700, 18);
        this.createTimeMachineButton(800, 18);
        this.createClimateButton(1015, 18);
        this.createMenuButton(1155, 18);
        this.layoutTopActionButtons();
    }

    layoutTopActionButtons() {
        const buttons = [
            this.elements.eventsButton,
            this.elements.tmButton,
            this.elements.climateButton,
            this.elements.menuButton
        ];
        if (buttons.some(button => !button)) return;

        // Use the former Events/Time Machine visual gap as the shared gap.
        const gap = 10;
        const rightEdge = 1260;
        let x = rightEdge;
        for (let i = buttons.length - 1; i >= 0; i -= 1) {
            const button = buttons[i];
            x -= button.displayWidth;
            button.x = x;
            x -= gap;
        }
    }

    createSpeedControls(x, y) {
        const speeds = [1, 2, 4];
        this.speedButtons = {};

        speeds.forEach((spd, index) => {
            const btn = this.scene.add.text(x + index * 40, y, `${spd}x`, {
                fontSize: '13px',
                fontFamily: 'Arial',
                color: spd === 1 ? '#0f172a' : '#f8fafc',
                backgroundColor: spd === 1 ? '#38bdf8' : '#334155',
                padding: { x: 6, y: 5 }
            });
            btn.setScrollFactor(0);
            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', (pointer) => {
                if (pointer && pointer.event) pointer.event.stopPropagation();
                this.scene.setGameSpeed(spd);
            });
            this.container.add(btn);
            this.speedButtons[spd] = btn;
        });
    }

    layoutSpeedControls() {
        const buttons = Object.values(this.speedButtons || {});
        if (buttons.length !== 3 || !this.elements.clockText || !this.elements.tempText) return;
        const first = buttons[0];
        const middle = buttons[1];
        const last = buttons[2];
        // Keep 2x exactly where the current layout placed it; bring 1x and 4x
        // back to the original 40px spacing on either side.
        first.x = middle.x - 40;
        last.x = middle.x + 40;
    }

    updateSpeedDisplay(activeSpeed) {
        Object.entries(this.speedButtons).forEach(([spd, btn]) => {
            if (Number(spd) === activeSpeed) {
                btn.setStyle({ color: '#0f172a', backgroundColor: '#38bdf8' });
            } else {
                btn.setStyle({ color: '#f8fafc', backgroundColor: '#334155' });
            }
        });
    }

    createTimeMachineButton(x, y) {
        const btn = this.scene.add.text(x, y, '🔄 Time Machine (4/4)', {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#0f172a',
            backgroundColor: '#38bdf8',
            padding: { x: 12, y: 7 }
        });
        btn.setScrollFactor(0);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#0ea5e9' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#38bdf8' }));
        btn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            this.scene.openTimeMachinePanel();
        });
        this.container.add(btn);
        this.elements.tmButton = btn;
    }

    createClimateButton(x, y) {
        const btn = this.scene.add.text(x, y, '📊 Climate', {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#0f172a',
            backgroundColor: '#22c55e',
            padding: { x: 10, y: 7 }
        });
        btn.setScrollFactor(0);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#16a34a' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#22c55e' }));
        btn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            this.scene.toggleClimateDashboard();
        });
        this.container.add(btn);
        this.elements.climateButton = btn;
    }

    createEventsButton(x, y) {
        const btn = this.scene.add.text(x, y, '⚠️ Events', {
            fontSize: '14px', fontFamily: 'Arial', color: '#0f172a',
            backgroundColor: '#fbbf24', padding: { x: 9, y: 7 }
        });
        btn.setScrollFactor(0);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerdown', pointer => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            this.scene.toggleClimateEvents();
        });
        this.container.add(btn);
        this.elements.eventsButton = btn;
    }

    createMenuButton(x, y) {
        const btn = this.scene.add.text(x, y, '⚙️ Menu', {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#f8fafc',
            backgroundColor: '#334155',
            padding: { x: 10, y: 7 }
        });
        btn.setScrollFactor(0);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#475569' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#334155' }));
        btn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            // Always launch MenuScene fresh so create() runs reliably and renders all options, bringing it to top
            if (this.scene.scene.isActive('MenuScene')) {
                this.scene.scene.stop('MenuScene');
            } else {
                this.scene.scene.launch('MenuScene', { fromGame: true });
                this.scene.scene.bringToTop('MenuScene');
            }
        });
        this.container.add(btn);
        this.elements.menuButton = btn;
    }

    showMenu() {
        if (this.scene.scene.isActive('MenuScene')) {
            this.scene.scene.stop('MenuScene');
        } else {
            this.scene.scene.launch('MenuScene', { fromGame: true });
            this.scene.scene.bringToTop('MenuScene');
        }
    }

    updateClock(day, hours, minutes) {
        const hh = String(hours).padStart(2, '0');
        const mm = String(minutes).padStart(2, '0');
        this.elements.clockText.setText(`Day ${day} — ${hh}:${mm}`);
    }

    updateTemperature(temp, is2016) {
        const color = temp >= 40 ? '#f43f5e' : temp >= 35 ? '#fbbf24' : '#34d399';
        this.elements.tempText.setText(`🌡️ ${temp.toFixed(1)}°C`);
        this.elements.tempText.setColor(color);
    }

    updateEC(ec) {
        this.elements.ecText.setText(`🪙 ${ec} EC`);
    }

    updateTimeMachineCharges(charges, max) {
        if (this.elements.tmButton) {
            this.elements.tmButton.setText(`🔄 Time Machine (${charges}/${max})`);
        }
    }

    updateEra(is2016) {
        if (is2016) {
            this.elements.eraText.setText('📅 2016 (Past)');
            this.elements.eraText.setColor('#34d399');
        } else {
            this.elements.eraText.setText('📅 2026 (Present)');
            this.elements.eraText.setColor('#f43f5e');
        }
    }
}
