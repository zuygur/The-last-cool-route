// MenuScene.js - Main menu (initial title screen vs in-game menu)

class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    init(data) {
        this.fromGame = data?.fromGame || false;
    }

    create() {
        if (this.fromGame) {
            // --- IN-GAME MENU (Accessed via top-right Menu button during gameplay) ---
            // Semi-transparent overlay with high depth so it sits above everything
            const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.75);
            overlay.setDepth(2000);
            overlay.setScrollFactor(0);
            overlay.setInteractive();
            overlay.on('pointerdown', (pointer) => {
                if (pointer && pointer.event) pointer.event.stopPropagation();
            });

            const panel = this.add.rectangle(640, 360, 480, 520, 0x0f172a, 0.98);
            panel.setDepth(2001);
            panel.setScrollFactor(0);
            panel.setStrokeStyle(2, 0x38bdf8);

            const title = this.add.text(640, 135, '⚙️ Game Menu', {
                fontSize: '26px',
                fontFamily: 'Arial',
                color: '#38bdf8',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);

            let startY = 200;
            const spacing = 55;

            this.createInGameButton(640, startY, 'Resume Game', () => {
                this.scene.stop();
            });
            startY += spacing;

            this.createInGameButton(640, startY, 'Settings', () => this.showPlaceholderModal('Settings', '⚙️ Game Settings\n\n• Audio Volume: 80%\n• Graphics Quality: High (Pixel Art)\n• Fullscreen Mode: Enabled\n• Heatwave Particle Effects: Active'));
            startY += spacing;

            this.createInGameButton(640, startY, 'Language / Dil', () => this.showLanguageModal());
            startY += spacing;

            this.createInGameButton(640, startY, 'Help & Controls', () => this.showPlaceholderModal('Help & Controls', '📖 Game Guide & Controls\n\n• Pan Map: Click and drag anywhere on the map.\n• Time Machine: Travel between 2016 Past and 2026 Present to shape urban planning.\n• Urban Planning (+): Open bottom-right planning menu to plant trees, add bus stops, bike lanes, solar & green roofs.\n• Missions: Click characters (Meryem, Deniz, Elif) and locations to help residents survive the heatwave!'));
            startY += spacing;

            this.createInGameButton(640, startY, 'Save Game', () => {
                const gameScene = this.scene.get('GameScene');
                const saved = gameScene?.saveGame(true);
                this.showPlaceholderModal('Save Game', saved
                    ? '💾 Game saved successfully on this device.\n\nYour city, missions, climate events, economy, and camera position were stored.'
                    : '⚠️ Save failed. Local storage is unavailable on this device.');
            });
            startY += spacing + 10;

            const closeBtn = this.add.text(640, startY, 'Close Menu', {
                fontSize: '15px',
                fontFamily: 'Arial',
                color: '#0f172a',
                backgroundColor: '#f43f5e',
                padding: { x: 22, y: 9 }
            }).setOrigin(0.5).setDepth(2002).setScrollFactor(0);
            closeBtn.setInteractive({ useHandCursor: true });
            closeBtn.on('pointerdown', (pointer) => {
                if (pointer && pointer.event) pointer.event.stopPropagation();
                this.scene.stop();
            });

            // ESC key support to close menu
            if (this.input.keyboard) {
                this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
                this.escKey.on('down', () => {
                    this.scene.stop();
                });
            }

        } else {
            // --- INITIAL TITLE SCREEN (Clean & Minimal per requirement) ---
            this.add.rectangle(640, 360, 1280, 720, 0x1a0a00);

            const title = this.add.text(640, 220, '42°C', {
                fontSize: '96px',
                fontFamily: 'Arial',
                color: '#ff6b6b',
                fontStyle: 'bold'
            });
            title.setOrigin(0.5, 0.5);

            const subtitle = this.add.text(640, 310, 'The Last Cool Route', {
                fontSize: '32px',
                fontFamily: 'Arial',
                color: '#ffffff'
            });
            subtitle.setOrigin(0.5, 0.5);

            this.createButton(640, 420, 'Start Game', () => {
                this.scene.start('GameScene');
            });

            this.createButton(640, 490, 'Continue', () => {
                this.scene.start('GameScene', { loadSaved: true });
            });

            // Credits
            this.add.text(640, 660, 'A Mediterranean heatwave simulation • 2026', {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#666666'
            }).setOrigin(0.5, 0.5);

            this.createHeatWaves();
        }
    }

    createButton(x, y, text, callback) {
        const btn = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#334155',
            padding: { x: 28, y: 10 }
        });
        btn.setOrigin(0.5, 0.5);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            btn.setStyle({ backgroundColor: '#0284c7' });
        });

        btn.on('pointerout', () => {
            btn.setStyle({ backgroundColor: '#334155' });
        });

        btn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            callback();
        });

        return btn;
    }

    createInGameButton(x, y, text, callback) {
        const btn = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#1e293b',
            padding: { x: 32, y: 10 }
        });
        btn.setOrigin(0.5, 0.5);
        btn.setDepth(2002);
        btn.setScrollFactor(0);
        btn.setInteractive({ useHandCursor: true });

        btn.on('pointerover', () => {
            btn.setStyle({ backgroundColor: '#0284c7' });
        });

        btn.on('pointerout', () => {
            btn.setStyle({ backgroundColor: '#1e293b' });
        });

        btn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            callback();
        });

        return btn;
    }

    showPlaceholderModal(titleText, contentText) {
        if (this.modalContainer) this.modalContainer.destroy();

        const container = this.add.container(640, 360);
        container.setDepth(3000);
        container.setScrollFactor(0);

        const overlay = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.75);
        overlay.setInteractive();
        overlay.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
        });

        const box = this.add.rectangle(0, 0, 500, 300, 0x0f172a, 0.95);
        box.setStrokeStyle(2, 0x38bdf8);

        const title = this.add.text(0, -110, titleText, {
            fontSize: '22px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const content = this.add.text(0, -15, contentText, {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#f8fafc',
            align: 'center',
            wordWrap: { width: 440 }
        }).setOrigin(0.5);

        const closeBtn = this.add.text(0, 105, 'Close', {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#0f172a',
            backgroundColor: '#38bdf8',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            container.destroy();
        });

        container.add([overlay, box, title, content, closeBtn]);
        this.modalContainer = container;
    }

    showLanguageModal() {
        if (this.modalContainer) this.modalContainer.destroy();

        const container = this.add.container(640, 360);
        container.setDepth(3000);
        container.setScrollFactor(0);

        const overlay = this.add.rectangle(0, 0, 1280, 720, 0x000000, 0.75);
        overlay.setInteractive();
        overlay.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
        });

        const box = this.add.rectangle(0, 0, 480, 280, 0x0f172a, 0.95);
        box.setStrokeStyle(2, 0x38bdf8);

        const title = this.add.text(0, -100, '🌍 Language / Dil Seçimi', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const btnEn = this.add.text(0, -35, '🇬🇧 English (Active)', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#0f172a',
            backgroundColor: '#34d399',
            padding: { x: 25, y: 8 }
        }).setOrigin(0.5);
        btnEn.setInteractive({ useHandCursor: true });
        btnEn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            btnEn.setText('🇬🇧 English (Selected)');
        });

        const btnTr = this.add.text(0, 25, '🇹🇷 Türkçe (Coming Soon)', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#f8fafc',
            backgroundColor: '#334155',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        btnTr.setInteractive({ useHandCursor: true });
        btnTr.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            btnTr.setText('🇹🇷 Türkçe (Selected!)');
            btnEn.setText('🇬🇧 English');
            btnEn.setBackgroundColor('#334155');
            btnEn.setColor('#f8fafc');
            btnTr.setBackgroundColor('#38bdf8');
            btnTr.setColor('#0f172a');
        });

        const closeBtn = this.add.text(0, 95, 'Close', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#0f172a',
            backgroundColor: '#94a3b8',
            padding: { x: 16, y: 6 }
        }).setOrigin(0.5);
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            container.destroy();
        });

        container.add([overlay, box, title, btnEn, btnTr, closeBtn]);
        this.modalContainer = container;
    }

    createHeatWaves() {
        for (let i = 0; i < 5; i++) {
            const wave = this.add.text(640 + (i - 2) * 150, 680, '~~~~~', {
                fontSize: '24px',
                color: '#ff6b6b',
                alpha: 0.3
            });

            this.tweens.add({
                targets: wave,
                alpha: 0.1,
                x: wave.x - 20,
                duration: 2000 + i * 300,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }
}
