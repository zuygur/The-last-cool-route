// Location.js - Clickable map locations supporting dual eras (2016 vs 2026) with accurate block labeling

class Location {
    constructor(scene, id, name, x, y, type, description) {
        this.scene = scene;
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.type = type; // 'residential', 'school', 'hospital', 'park', 'busStop', 'coolingCenter', 'energyStation', 'parkingLot'
        this.description = description;
        this.isSelected = false;
        this.sprite = null;
        this.label = null;
    }

    create() {
        const textureKey = this.getTextureKey(true);
        this.sprite = this.scene.add.sprite(this.x, this.y, textureKey);
        this.sprite.setInteractive({ useHandCursor: true });
        this.sprite.setDepth(100);

        // Adjust label position based on whether it is a small bus stop or a full block
        const labelOffsetY = this.type === 'busStop' ? 22 : 124;

        // Use a container label so Phaser's Text bounds/culling do not include
        // backgroundColor/padding in the text object's own bounds.
        this.label = this.scene.add.container(this.x, this.y + labelOffsetY);
        this.label.ignoreCull = true;
        this.label.setDepth(101);

        const labelText = this.scene.add.text(0, 0, this.name, {
            fontSize: '11px',
            fontFamily: 'Arial',
            color: '#f8fafc',
            align: 'center'
        });
        labelText.setOrigin(0.5, 0);
        labelText.setName('text');

        const labelBg = this.scene.add.rectangle(0, labelText.height / 2 + 3,
            labelText.width + 10, labelText.height + 6, 0x0f172a, 1);
        labelBg.setOrigin(0.5, 0.5);
        labelBg.setName('background');

        this.label.add([labelBg, labelText]);

        // Placement mode takes priority over normal location inspection. This is
        // required for rooftop solar/green-roof clicks: the building sprite must
        // confirm placement instead of opening its information panel first.
        this.sprite.on('pointerdown', pointer => {
            if (this.scene.placementMode?.active) {
                pointer?.event?.stopPropagation();
                this.scene.ignorePlacementPointerUp = true;
                this.scene.tryPlaceItem(pointer);
                return;
            }
            this.select();
        });
        this.sprite.on('pointerover', () => {
            this.sprite.setTint(0xcccccc);
        });
        this.sprite.on('pointerout', () => {
            if (!this.isSelected) {
                this.sprite.clearTint();
            }
        });

        return this.sprite;
    }

    getTextureKey(is2016) {
        if (this.type === 'residential') {
            return is2016 ? 'loc_residential_2016' : 'loc_residential_2026';
        }
        return `loc_${this.type}`;
    }

    updateEraVisual(is2016) {
        if (this.sprite) {
            const newTexture = this.getTextureKey(is2016);
            this.sprite.setTexture(newTexture);
        }
    }

    select() {
        if (this.scene.selectedLocation) {
            this.scene.selectedLocation.deselect();
        }

        this.isSelected = true;
        this.sprite.setTint(0x00CED1);
        this.scene.selectedLocation = this;
        this.scene.showLocationInfo(this);
    }

    deselect() {
        this.isSelected = false;
        this.sprite.clearTint();
    }

    getInfo() {
        return {
            name: this.name,
            type: this.type,
            description: this.description,
            x: this.x,
            y: this.y
        };
    }

    destroy() {
        if (this.sprite) this.sprite.destroy();
        if (this.label) this.label.destroy();
    }
}
