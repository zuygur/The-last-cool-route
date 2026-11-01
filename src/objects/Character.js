// Character.js - NPC characters on the map with rich climate stories and missions

class Character {
    constructor(scene, id, name, x, y, type, description, storyData) {
        this.scene = scene;
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.type = type; // e.g. 'meryem', 'elif', 'ayse'...
        this.description = description;
        this.storyData = storyData || {};

        // Optional needs (kept for compatibility with the earlier UI idea)
        this.needs = this.storyData?.needs || {};

        this.isSelected = false;
        this.sprite = null;
        this.label = null;
        this.statusIcon = null;
        this.pointerHintText = null;
    }

    create() {
        // Create sprite
        const textureKey = `char_${this.type}`;
        this.sprite = this.scene.add.sprite(this.x, this.y, textureKey);
        this.sprite.setInteractive({ useHandCursor: true });
        this.sprite.setDepth(200);

        // Add label above character
        // Keep the text plain and put its background in a separate container
        // to avoid Phaser WebGL culling errors during camera movement.
        this.label = this.scene.add.container(this.x, this.y - 30);
        this.label.ignoreCull = true;
        this.label.setDepth(200);

        const labelText = this.scene.add.text(0, 0, this.name, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#ffffff',
            align: 'center'
        });
        labelText.setOrigin(0.5, 1);
        labelText.setName('text');

        const labelBg = this.scene.add.rectangle(0, -labelText.height / 2 - 1,
            labelText.width + 8, labelText.height + 4, 0x000000, 1);
        labelBg.setOrigin(0.5, 0.5);
        labelBg.setName('background');

        this.label.add([labelBg, labelText]);

        // Status indicator (optional)
        this.updateStatusIcon();

        // Click handler
        this.sprite.on('pointerdown', () => this.select());

        // Hover effects
        this.sprite.on('pointerover', () => {
            this.sprite.setTint(0xcccccc);
            if (this.pointerHintText) this.pointerHintText.destroy();
            this.pointerHintText = this.scene.add.text(this.x, this.y - 50, '👆', {
                fontSize: '16px'
            }).setDepth(201).setOrigin(0.5).setAlpha(0.8);
        });

        this.sprite.on('pointerout', () => {
            if (!this.isSelected) {
                this.sprite.clearTint();
            }
            if (this.pointerHintText) {
                this.pointerHintText.destroy();
                this.pointerHintText = null;
            }
        });

        return this.sprite;
    }

    select() {
        if (this.scene.selectedCharacter) {
            this.scene.selectedCharacter.deselect();
        }

        this.isSelected = true;
        this.sprite.setTint(0xFFFF00);
        this.scene.selectedCharacter = this;
        this.scene.showCharacterInfo(this);
    }

    deselect() {
        this.isSelected = false;
        if (this.sprite) this.sprite.clearTint();
    }

    updateStatusIcon() {
        if (this.statusIcon) {
            this.statusIcon.destroy();
            this.statusIcon = null;
        }

        // If a specific character icon is provided, prefer it.
        const forcedIcon = this.storyData && this.storyData.humanIcon;

        let icon = '';
        if (forcedIcon) {
            icon = forcedIcon;
        } else {
            // Fallback to the earlier “needs” icon logic
            if (this.needs.water && this.needs.water > 50) {
                icon = '💧';
            } else if (this.needs.energy && this.needs.energy > 50) {
                icon = '⚡';
            } else if (this.needs.shelter) {
                icon = '🏠';
            }
        }

        if (icon) {
            this.statusIcon = this.scene.add.container(this.x + 15, this.y - 25);
            const iconText = this.scene.add.text(0, 0, icon, { fontSize: '14px' });
            iconText.setOrigin(0.5, 0.5);
            this.statusIcon.add(iconText);
            this.statusIcon.setDepth(201);
        }
    }

    getInfo() {
        return {
            name: this.name,
            type: this.type,
            description: this.description,
            story: this.storyData
        };
    }

    destroy() {
        if (this.sprite) this.sprite.destroy();
        if (this.label) this.label.destroy();
        if (this.statusIcon) this.statusIcon.destroy();
        if (this.pointerHintText) this.pointerHintText.destroy();
    }
}
