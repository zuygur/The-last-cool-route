// GameScene.js - Step 1: Accurate two-way road traffic following right-hand drive rules

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.selectedLocation = null;
        this.selectedCharacter = null;

        this.gameData = {
            is2016: true,
            day: 1,
            hour: 8,
            minute: 0,
            speed: 1,
            ec: 300,
            tmCharges: 4,
            maxTmCharges: 4,
            chargePackCost: 40,
            temperature: 34.0,

            pastState: {
                saplingsPlanted: 0,
                busStopsAdded: 0,
                parkingLotsOpened: 0,
                bikeLanesAdded: 0,
                // Water management preparedness built in 2016
                rainGardensAdded: 0,
                permeablePavementsAdded: 0,
                rainCollectorsAdded: 0,
                waterSavingAdded: 0,
                droughtGreensAdded: 0
            },
            futureState: {
                matureTrees: 0,
                busStops: 1,
                parkingLots: 0,
                bikeLanes: false,
                // Water management preparedness carried into 2026
                rainGardens: 0,
                permeablePavements: 0,
                rainCollectors: 0,
                waterSaving: 0,
                droughtGreens: 0
            },

            missions: {
                meryemHelp: false,
                denizHelp: false,
                elifHelp: false,
                ayseHelp: false,
                hasanHelp: false,
                zeynepHelp: false
            },
            climateMemory: {},
            economyStats: { spent: 0, builds: 0 },
            climateEvents: {
                heatwave: { status: 'pending', prepared: false, announced: false },
                waterCrisis: { status: 'locked', prepared: false, announced: false },
                flashFlood: { status: 'locked', prepared: false, announced: false },
                active: null,
                lastResolved: null
            }
        };

        const saved = data?.loadSaved ? this.readSavedGame() : null;
        this.pendingSavedPlacedItems = saved?.placedItems || [];
        this.pendingSavedCamera = saved?.camera || null;
        if (saved?.gameData) {
            this.gameData = this.mergeSavedGameData(this.gameData, saved.gameData);
        }

        this.timeAccumulator = 0;
        this.autosaveAccumulator = 0;
        this.ignorePlacementPointerUp = false;
        this.placedItems = [];
        this.placementMode = null;
        this.relocationTarget = null;
        this.urbanPlanningPanelVisible = false;
        this.planningScrollIndex = 0;

        // Phase 4: Shared climate simulation state. Values are fictional game scores (0-100).
        this.climateDashboardVisible = false;
        this.climatePanel = null;
        this.climateIndicatorRows = null;
        this.climateDashboardNextRefreshAt = 0;
        this.climateState = null;
        this.climateHistory = { past: null, future: null };
        this.climateBaseline = { past: null, future: null };
        this.heatMapVisible = false;
        this.heatMapOverlay = null;
        this.eventsPanelVisible = false;
        this.eventsPanel = null;
    }

    preload() {
        Graphics.preloadAssets(this);
    }

    getSaveStorageKey() {
        return 'lastCoolRoute.save.v1';
    }

    mergeSavedGameData(defaultData, savedData) {
        const merge = (base, incoming) => {
            if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return base;
            Object.keys(incoming).forEach(key => {
                if (incoming[key] && typeof incoming[key] === 'object' && !Array.isArray(incoming[key]) && base[key]) {
                    base[key] = merge(base[key], incoming[key]);
                } else if (incoming[key] !== undefined) {
                    base[key] = incoming[key];
                }
            });
            return base;
        };
        return merge(defaultData, savedData);
    }

    readSavedGame() {
        try {
            const raw = window.localStorage.getItem(this.getSaveStorageKey());
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed?.version === 1 ? parsed : null;
        } catch (error) {
            console.warn('Saved game could not be read:', error);
            return null;
        }
    }

    saveGame(showFeedback = false) {
        try {
            const placedItems = (this.placedItems || []).map(({ sprite, ...item }) => item);
            const payload = {
                version: 1,
                savedAt: new Date().toISOString(),
                gameData: this.gameData,
                placedItems,
                camera: { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY }
            };
            window.localStorage.setItem(this.getSaveStorageKey(), JSON.stringify(payload));
            if (showFeedback) this.notify('Game saved locally.', 'success');
            return true;
        } catch (error) {
            console.warn('Game could not be saved:', error);
            if (showFeedback) this.notify('Save failed on this device.', 'warning');
            return false;
        }
    }

    restoreSavedPlacedItems() {
        (this.pendingSavedPlacedItems || []).forEach(savedItem => {
            const item = this.urbanPlanningItems.find(candidate => candidate.id === savedItem.type);
            if (!item || !Number.isFinite(savedItem.x) || !Number.isFinite(savedItem.y)) return;
            const sprite = this.add.sprite(savedItem.x, savedItem.y, item.texture2016);
            if (Number.isFinite(savedItem.rotation)) sprite.setRotation(savedItem.rotation);
            if (!this.gameData.is2016) sprite.setTexture(item.texture2026);
            const depth = item.allowedZone === 'road' ? 85 : (item.allowedZone === 'building' ? 120 : 180);
            sprite.setDepth(depth);
            const restoredRecord = { ...savedItem, item, type: item.id, sprite };
            this.placedItems.push(restoredRecord);
            if (item.id === 'busStop') this.registerFunctionalBusStop(restoredRecord);
        });
        this.pendingSavedPlacedItems = [];
    }

    registerFunctionalBusStop(placedRecord) {
        if (!placedRecord || placedRecord.type !== 'busStop' || !this.busStopsData) return;
        const alreadyRegistered = this.busStopsData.some(stop =>
            stop.placedId === placedRecord.id || (Math.abs(stop.x - placedRecord.x) < 1 && Math.abs(stop.y - placedRecord.y) < 1)
        );
        if (alreadyRegistered) return;

        const nearestHorizontal = this.roadY.reduce((best, y) =>
            Math.abs(y - placedRecord.y) < Math.abs(best - placedRecord.y) ? y : best, this.roadY[0]);
        const nearestVertical = this.roadX.reduce((best, x) =>
            Math.abs(x - placedRecord.x) < Math.abs(best - placedRecord.x) ? x : best, this.roadX[0]);
        const horizontalDistance = Math.abs(nearestHorizontal - placedRecord.y);
        const verticalDistance = Math.abs(nearestVertical - placedRecord.x);
        const routePoint = horizontalDistance <= verticalDistance
            ? { x: placedRecord.x, y: nearestHorizontal }
            : { x: nearestVertical, y: placedRecord.y };
        const stopId = `placed-${placedRecord.id}`;
        const stop = {
            id: stopId,
            placedId: placedRecord.id,
            name: 'Newly Built Bus Stop',
            x: placedRecord.x,
            y: placedRecord.y,
            waitingPassengers: []
        };
        this.busStopsData.push(stop);
        [-14, 14].forEach(offset => {
            const ped = this.add.sprite(stop.x + offset, stop.y, 'ped_general');
            ped.setDepth(210);
            stop.waitingPassengers.push(ped);
        });
        this.busRoute.push({
            x: routePoint.x,
            y: routePoint.y,
            stopId,
            stopName: stop.name
        });
    }

    clearSavedGame() {
        try {
            window.localStorage.removeItem(this.getSaveStorageKey());
            return true;
        } catch (error) {
            console.warn('Saved game could not be cleared:', error);
            return false;
        }
    }

    create() {
        // Expand world bounds (2560x1440)
        this.cameras.main.setBounds(0, 0, 2560, 1440);
        this.physics?.world?.setBounds(0, 0, 2560, 1440);

        // Grid road coordinates
        this.roadY = [220, 620, 1020];
        this.roadX = [220, 780, 1340, 1900];

        this.createRoadsAndCrosswalks();
        this.createPlannedCityBlocks();
        this.createBusStops();
        this.createTwoWayTraffic();
        this.createTransitBus();
        this.createSidewalkPedestrians();
        this.createCharacters();
        this.setupPassengerSpawnTimer();

        // HUD (Fixed to camera view)
        this.hud = new HUD(this);
        this.hud.create();
        this.hud.updateClock(this.gameData.day, this.gameData.hour, this.gameData.minute);
        this.hud.updateTemperature(this.gameData.temperature, this.gameData.is2016);
        this.hud.updateEC(this.gameData.ec);
        this.hud.updateTimeMachineCharges(this.gameData.tmCharges, this.gameData.maxTmCharges);
        this.hud.updateEra(this.gameData.is2016);

        this.createInfoPanel();
        this.createClimateDashboard();
        this.createClimateEventsPanel();
        this.createNotificationBanner();
        this.createUrbanPlanningMenu();
        this.createPlacementBanner();
        this.restoreSavedPlacedItems();
        if (this.pendingSavedCamera) {
            this.cameras.main.scrollX = Phaser.Math.Clamp(this.pendingSavedCamera.x || 0, 0, 1280);
            this.cameras.main.scrollY = Phaser.Math.Clamp(this.pendingSavedCamera.y || 0, 0, 720);
        }

        this.showInfoPanel(
            Strings.get('welcomeTitle'),
            Strings.get('welcomeDesc') + "\n\nTip: Click and drag anywhere on the map to pan across the district!"
        );

        this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.rotateKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        this.rotateKey.on('down', () => this.rotatePlacement());
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Mouse Drag Pan Mechanism & Click-to-Place
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let dragDist = 0;

        this.input.on('pointerdown', (pointer, gameObjects) => {
            this.ignorePlacementPointerUp = false;
            this.placementDragStart = null;
            // Only fixed panels consume pointer-down events. The Heat Map itself is
            // world-space and intentionally remains transparent to camera dragging.
            const insideClimate = this.climateDashboardVisible && this.climatePanel?.visible &&
                pointer.x >= this.climatePanel.x && pointer.x <= this.climatePanel.x + 520 &&
                pointer.y >= this.climatePanel.y && pointer.y <= this.climatePanel.y + 520;
            const insideEvents = this.eventsPanelVisible && this.eventsPanel?.visible &&
                pointer.x >= this.eventsPanel.x && pointer.x <= this.eventsPanel.x + 520 &&
                pointer.y >= this.eventsPanel.y && pointer.y <= this.eventsPanel.y + 300;
            if (insideClimate || insideEvents) return;

            // Other fixed UI objects must not start map dragging or trigger a map placement.
            if (gameObjects && gameObjects.length > 0 && gameObjects.some(go => go.scrollFactorX === 0)) {
                this.ignorePlacementPointerUp = true;
                return;
            }

            isDragging = true;
            startX = pointer.x;
            startY = pointer.y;
            dragDist = 0;
            if (this.placementMode && this.placementMode.active && this.placementMode.item.id === 'bikeLane') {
                this.placementDragStart = { x: pointer.worldX, y: pointer.worldY };
            }
        });

        this.input.on('pointermove', (pointer) => {
            if (isDragging) {
                const dx = pointer.x - startX;
                const dy = pointer.y - startY;
                dragDist += Math.hypot(dx, dy);
                this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
                this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
                startX = pointer.x;
                startY = pointer.y;
            }
            if (this.placementMode && this.placementMode.active) {
                this.updatePlacementGhost(pointer);
            }
        });

        this.input.on('pointerup', (pointer) => {
            isDragging = false;
            // If in placement mode and user clicked rather than dragged
            if (this.placementMode && this.placementMode.active && dragDist >= 10 && this.placementMode.item.id === 'bikeLane' && !this.ignorePlacementPointerUp) {
                const start = this.placementDragStart;
                const end = { x: pointer.worldX, y: pointer.worldY };
                if (start) {
                    const horizontal = Math.abs(end.y - start.y) <= 24;
                    const vertical = Math.abs(end.x - start.x) <= 24;
                    if (horizontal || vertical) {
                        const distance = Math.hypot(end.x - start.x, end.y - start.y);
                        const segments = Math.max(1, Math.ceil(distance / 80));
                        const dx = (end.x - start.x) / segments;
                        const dy = (end.y - start.y) / segments;
                        for (let i = 1; i <= segments; i += 1) {
                            const segmentPointer = { worldX: start.x + dx * i, worldY: start.y + dy * i };
                            this.tryPlaceItem(segmentPointer);
                            if (!this.placementMode || !this.placementMode.active) break;
                        }
                    }
                }
                this.placementDragStart = null;
                return;
            }

            if (this.placementMode && this.placementMode.active && dragDist < 10 && !this.ignorePlacementPointerUp) {
                // Ignore clicks on top HUD / overlays
                const climateOpen = !!(this.climateDashboardVisible && this.climatePanel && this.climatePanel.visible);
                const infoOpen = !!(this.infoPanelBg && this.infoPanelBg.visible);
                const planningOpen = !!this.urbanPlanningPanelVisible;

                if (pointer.y > 115 && !climateOpen && !infoOpen && !planningOpen) {
                    this.tryPlaceItem(pointer);
                }
            }
        });
    }

    setGameSpeed(speed) {
        this.gameData.speed = speed;
        this.hud.updateSpeedDisplay(speed);
    }

    // 4. Urban Planning Menu System (Decoupled on Bottom-Right Corner opening upwards)
    createUrbanPlanningMenu() {
        this.urbanPlanningItems = [
            {
                id: 'sapling',
                name: 'Plant Sapling',
                icon: '🌱',
                cost: 2,
                desc: 'Grows into a mature 2026 shade tree (-0.5°C)',
                texture2016: 'item_sapling',
                texture2026: 'item_tree_mature',
                allowedZone: 'sidewalk_or_park',
                coolEffect: 0.5
            },
            {
                id: 'busStop',
                name: 'Add Bus Stop',
                icon: '🚏',
                cost: 15,
                desc: 'Expands transit network on sidewalks',
                texture2016: 'loc_busStop',
                texture2026: 'loc_busStop',
                allowedZone: 'sidewalk_or_park',
                coolEffect: 0.2
            },
            {
                id: 'bikeLane',
                name: 'Paint Bike Lane',
                icon: '🚲',
                cost: 5,
                desc: 'Eco-mobility strip, encourages cycling',
                texture2016: 'item_bikeLane',
                texture2026: 'item_bikeLane',
                allowedZone: 'road',
                coolEffect: 0.3
            },
            {
                id: 'shadeAwning',
                name: 'Shade Awning',
                icon: '⛱️',
                cost: 10,
                desc: 'Immediate UV & heat barrier for walkers',
                texture2016: 'item_awning',
                texture2026: 'item_awning',
                allowedZone: 'sidewalk',
                coolEffect: 0.4
            },
            {
                id: 'solarRoof',
                name: 'Rooftop Solar',
                icon: '☀️',
                cost: 10,
                desc: 'Clean energy generation on roofs',
                texture2016: 'item_solarRoof',
                texture2026: 'item_solarRoof',
                allowedZone: 'building',
                coolEffect: 0.3
            },
            {
                id: 'greenRoof',
                name: 'Green Roof Garden',
                icon: '🌿',
                cost: 10,
                desc: 'Living rooftop vegetation reduces heat',
                texture2016: 'item_greenRoof',
                texture2026: 'item_greenRoof',
                allowedZone: 'building',
                coolEffect: 0.6
            },
            {
                id: 'fountain',
                name: 'Cooling Fountain',
                icon: '⛲',
                cost: 10,
                desc: 'Civic water misting & cooling oasis (acts like a rain garden)',
                texture2016: 'item_fountain',
                texture2026: 'item_fountain',
                allowedZone: 'sidewalk_or_park',
                coolEffect: 0.8
            },
            // Water management items (new for Phase 3)

            {
                id: 'permeablePavement',
                name: 'Permeable Pavement',
                icon: '🧱',
                cost: 5,
                desc: 'Rain soaks in instead of flooding — improves drainage',
                // Reuse fountain texture until dedicated textures are added
                texture2016: 'item_fountain',
                texture2026: 'item_fountain',
                allowedZone: 'road'
            },
            {
                id: 'rainCollector',
                name: 'Rainwater Collector',
                icon: '🪣',
                cost: 5,
                desc: 'Collects runoff for safer water storage during dry periods',
                // Reuse fountain texture until dedicated textures are added
                texture2016: 'item_fountain',
                texture2026: 'item_fountain',
                allowedZone: 'sidewalk_or_park'
            },
            {
                id: 'waterSaving',
                name: 'Water-Saving Infrastructure',
                icon: '🚰',
                cost: 5,
                desc: 'Reduces daily water waste during drought periods',
                // Reuse fountain texture until dedicated textures are added
                texture2016: 'item_fountain',
                texture2026: 'item_fountain',
                allowedZone: 'building'
            },
            {
                id: 'droughtGreen',
                name: 'Drought-Resistant Greens',
                icon: '🌵',
                cost: 5,
                desc: 'Lower water-demand vegetation for resilient neighborhoods',
                // Reuse fountain texture until dedicated textures are added
                texture2016: 'item_fountain',
                texture2026: 'item_fountain',
                allowedZone: 'building'
            }
        ];

        // Dedicated Plus Button at Bottom-Right Corner (x: 1230, y: 680)
        const btn = this.add.text(1230, 680, '🏗️ Urban Planning (+)', {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#0284c7',
            padding: { x: 14, y: 9 }
        });
        btn.setOrigin(1, 1);
        btn.setScrollFactor(0);
        btn.setDepth(2500);
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#0ea5e9' }));
        btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#0284c7' }));
        btn.on('pointerdown', () => this.toggleUrbanPlanningPanel());
        this.plusBtn = btn;

        // Slide-Out Panel positioned at Bottom-Right opening upwards (x: 1230, y: 410)
        this.planningPanel = this.add.container(1115, 410);
        this.planningPanel.setScrollFactor(0);
        this.planningPanel.setDepth(2600);
        this.planningPanel.setVisible(false);
        this.planningPanel.ignoreCull = true;

        const bg = this.add.rectangle(0, 0, 310, 520, 0x0f172a, 0.96);
        bg.setScrollFactor(0);
        bg.ignoreCull = true;
        bg.setInteractive();
        bg.on('pointerdown', pointer => pointer?.event?.stopPropagation());
        const border = this.add.rectangle(0, 0, 314, 524, 0x38bdf8, 1);
        border.setScrollFactor(0);
        border.ignoreCull = true;
        border.setDepth(-1);
        this.planningPanel.add([border, bg]);

        this.planningTitle = this.add.text(-140, -240, '🏗️ Urban Planning (2016)', {
            fontSize: '17px',
            fontFamily: 'Arial',
            color: '#7dd3fc',
            fontStyle: 'bold'
        });
        this.planningSubtitle = this.add.text(-140, -215, 'Select an initiative to place on the map:', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#cbd5e1'
        });

        // Phase 3: update list-size hint when we add new infrastructure categories
        const closeBtn = this.add.text(130, -242, '✕', {
            fontSize: '15px',
            fontFamily: 'Arial',
            color: '#f43f5e',
            backgroundColor: '#1e293b',
            padding: { x: 5, y: 2 }
        });
        closeBtn.setInteractive({ useHandCursor: true });
        closeBtn.on('pointerdown', () => this.toggleUrbanPlanningPanel(false));

        this.scrollUpBtn = this.add.text(115, -185, '▲', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            backgroundColor: '#1e293b',
            padding: { x: 6, y: 3 }
        });
        this.scrollUpBtn.setInteractive({ useHandCursor: true });
        this.scrollUpBtn.on('pointerdown', () => this.scrollPlanningList(-1));

        this.scrollDownBtn = this.add.text(115, 220, '▼', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            backgroundColor: '#1e293b',
            padding: { x: 6, y: 3 }
        });
        this.scrollDownBtn.setInteractive({ useHandCursor: true });
        this.scrollDownBtn.on('pointerdown', () => this.scrollPlanningList(1));

        this.scrollPageText = this.add.text(-140, 225, 'Showing 1-5 of 7 items', {
            fontSize: '11px',
            fontFamily: 'Arial',
            color: '#64748b'
        });

        [this.planningTitle, this.planningSubtitle, closeBtn, this.scrollUpBtn, this.scrollDownBtn, this.scrollPageText].forEach(element => {
            element.setScrollFactor(0);
            element.ignoreCull = true;
        });
        this.cardsContainer = this.add.container(0, 0);
        this.cardsContainer.setScrollFactor(0);
        this.cardsContainer.ignoreCull = true;
        this.planningPanel.add([this.planningTitle, this.planningSubtitle, closeBtn, this.scrollUpBtn, this.scrollDownBtn, this.scrollPageText, this.cardsContainer]);

        this.renderUrbanPlanningCards();
    }

    toggleUrbanPlanningPanel(forceState) {
        this.urbanPlanningPanelVisible = (forceState !== undefined) ? forceState : !this.urbanPlanningPanelVisible;
        this.planningPanel.setVisible(this.urbanPlanningPanelVisible);

        if (this.urbanPlanningPanelVisible) {
            this.renderUrbanPlanningCards();
        }
    }

    scrollPlanningList(direction) {
        const maxScroll = Math.max(0, this.urbanPlanningItems.length - 5);
        this.planningScrollIndex = Phaser.Math.Clamp(this.planningScrollIndex + direction, 0, maxScroll);
        this.renderUrbanPlanningCards();
    }

    renderUrbanPlanningCards() {
        this.cardsContainer.removeAll(true);

        if (!this.gameData.is2016) {
            this.planningTitle.setText('🏗️ Urban Planning [Locked]');
            this.planningTitle.setColor('#ef4444');
            this.planningSubtitle.setText('⚠️ Travel to 2016 via Time Machine to shape future!');
            this.planningSubtitle.setColor('#f87171');
        } else {
            this.planningTitle.setText('🏗️ Urban Planning (2016)');
            this.planningTitle.setColor('#38bdf8');
            this.planningSubtitle.setText('Select an initiative to place on the map:');
            this.planningSubtitle.setColor('#94a3b8');
        }

        const visibleItems = this.urbanPlanningItems.slice(this.planningScrollIndex, this.planningScrollIndex + 5);
        this.scrollPageText.setText(`Showing ${this.planningScrollIndex + 1}-${this.planningScrollIndex + visibleItems.length} of ${this.urbanPlanningItems.length} items`);

        visibleItems.forEach((item, index) => {
            const cardY = -150 + (index * 75);
            const card = this.add.container(0, cardY);
            card.setScrollFactor(0);
            card.ignoreCull = true;
            card.setDepth(1);

            const cardBg = this.add.rectangle(0, 0, 290, 68, 0x1e293b, 1);
            cardBg.setScrollFactor(0);
            cardBg.ignoreCull = true;
            cardBg.setDepth(1);
            cardBg.setStrokeStyle(1, 0x334155);
            cardBg.setInteractive({ useHandCursor: this.gameData.is2016 });

            cardBg.on('pointerover', () => {
                if (this.gameData.is2016) {
                    cardBg.setFillStyle(0x334155);
                    cardBg.setStrokeStyle(2, 0x38bdf8);
                }
            });
            cardBg.on('pointerout', () => {
                cardBg.setFillStyle(0x1e293b);
                cardBg.setStrokeStyle(1, 0x334155);
            });
            cardBg.on('pointerdown', pointer => {
                pointer?.event?.stopPropagation();
                this.ignorePlacementPointerUp = true;
                if (this.gameData.is2016) {
                    this.enterPlacementMode(item);
                }
            });

            const icon = this.add.text(-125, -2, item.icon, { fontSize: '22px' });
            icon.setOrigin(0, 0.5);

            const title = this.add.text(-90, -22, item.name, {
                fontSize: '14px',
                fontFamily: 'Arial',
                color: '#f8fafc',
                fontStyle: 'bold'
            });

            const desc = this.add.text(-90, -4, item.desc, {
                fontSize: '11px',
                fontFamily: 'Arial',
                color: '#cbd5e1',
                wordWrap: { width: 175 }
            });

            const costBadge = this.add.text(92, -22, `🪙 ${item.cost} EC`, {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: this.gameData.ec >= item.cost ? '#facc15' : '#ef4444',
                fontStyle: 'bold'
            });

            [icon, title, desc, costBadge].forEach(element => {
                element.setScrollFactor(0);
                element.ignoreCull = true;
                element.setDepth(2);
            });

            const placeBtn = this.add.text(95, 10, 'Place 🎯', {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#0f172a',
                backgroundColor: this.gameData.is2016 && this.gameData.ec >= item.cost ? '#38bdf8' : '#64748b',
                padding: { x: 6, y: 3 }
            });
            placeBtn.setOrigin(0.5);
            placeBtn.setScrollFactor(0);
            placeBtn.ignoreCull = true;
            placeBtn.setDepth(3);
            placeBtn.setInteractive({ useHandCursor: this.gameData.is2016 });
            placeBtn.on('pointerdown', pointer => {
                pointer?.event?.stopPropagation();
                this.ignorePlacementPointerUp = true;
                if (this.gameData.is2016) this.enterPlacementMode(item);
            });

            card.add([cardBg, icon, title, desc, costBadge, placeBtn]);
            this.cardsContainer.add(card);
        });
    }

    // 5. Click-to-Place Mode & Cursor Ghost Preview
    createPlacementBanner() {
        this.placementBanner = this.add.container(640, 94);
        this.placementBanner.setScrollFactor(0);
        this.placementBanner.setDepth(3000);
        this.placementBanner.setVisible(false);

        const bannerBg = this.add.rectangle(0, 0, 780, 40, 0x0f172a, 0.95);
        const bannerBorder = this.add.rectangle(0, 0, 784, 44, 0x38bdf8, 1);
        bannerBorder.setDepth(-1);

        this.placementBannerText = this.add.text(-360, 0, '', {
            fontSize: '13px',
            fontFamily: 'Arial',
            color: '#f8fafc',
            fontStyle: 'bold'
        });
        this.placementBannerText.setOrigin(0, 0.5);

        const cancelBtn = this.add.text(380, 0, '✕ Cancel (ESC)', {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#f43f5e',
            backgroundColor: '#1e293b',
            padding: { x: 8, y: 4 }
        });
        cancelBtn.setOrigin(1, 0.5);
        cancelBtn.setInteractive({ useHandCursor: true });
        cancelBtn.on('pointerdown', pointer => {
            pointer?.event?.stopPropagation();
            this.ignorePlacementPointerUp = true;
            this.cancelPlacementMode();
        });

        this.placementBanner.add([bannerBorder, bannerBg, this.placementBannerText, cancelBtn]);
    }

    enterPlacementMode(item) {
        if (item.id === 'sapling' && !this.gameData.is2016) {
            this.showInfoPanel('Trees Are 2016 Only', 'New trees can only be planted in 2016. Existing saplings become mature trees in 2026.', 'info');
            return;
        }

        if (!this.gameData.is2016) {
            this.showInfoPanel('Future Era Locked', 'Urban planning initiatives must be built in 2016 so they mature in 2026!', 'info');
            return;
        }

        if (this.gameData.ec < item.cost) {
            this.showInfoPanel('Insufficient Eco Credits', `You have ${this.gameData.ec} EC, but need ${item.cost} EC to build ${item.name}.`, 'info');
            return;
        }

        this.toggleUrbanPlanningPanel(false);
        this.hideInfoPanel();

        this.placementMode = {
            active: true,
            item: item,
            valid: false,
            rotation: 0,
            lastWorldX: null,
            lastWorldY: null
        };

        this.placementBanner.setVisible(true);
        this.placementBannerText.setText(`🎯 Placing: ${item.icon} ${item.name} (${item.cost} EC) — Move cursor over map${this.getPlacementRotationHint(item)}`);
        this.placementBannerText.setColor('#f8fafc');

        if (this.placementGhost) this.placementGhost.destroy();
        const pointer = this.input.activePointer;
        this.placementGhost = this.add.sprite(pointer.worldX, pointer.worldY, item.texture2016);
        this.placementGhost.setScrollFactor(1);
        this.placementGhost.ignoreCull = true;
        this.placementGhost.setDepth(2500);
        this.placementGhost.setAlpha(0.75);
        this.placementGhost.setRotation(this.placementMode.rotation);
    }

    getPlacementRotationHint(item) {
        const rotatable = ['busStop', 'bikeLane', 'shadeAwning', 'solarRoof', 'greenRoof', 'permeablePavement'];
        return rotatable.includes(item?.id) ? ' | Press R to rotate' : '';
    }

    rotatePlacement() {
        if (!this.placementMode?.active || !this.placementGhost) return;
        const item = this.placementMode.item;
        const rotatable = ['busStop', 'bikeLane', 'shadeAwning', 'solarRoof', 'greenRoof', 'permeablePavement'];
        if (!rotatable.includes(item.id)) return;
        this.placementMode.rotation = (this.placementMode.rotation + Math.PI / 2) % (Math.PI * 2);
        this.placementGhost.setRotation(this.placementMode.rotation);
        this.placementBannerText.setText(`🎯 Placing: ${item.icon} ${item.name} (${item.cost} EC) — Rotation: ${Math.round(this.placementMode.rotation * 180 / Math.PI)}° | Press R to rotate`);
    }

    updatePlacementGhost(pointer) {
        if (!this.placementMode || !this.placementMode.active || !this.placementGhost) return;

        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        this.placementMode.lastWorldX = worldX;
        this.placementMode.lastWorldY = worldY;

        this.placementGhost.x = worldX;
        this.placementGhost.y = worldY;

        const item = this.placementMode.item;
        const validity = this.checkPlacementValidity(item, worldX, worldY);
        this.placementMode.valid = validity.valid;

        if (validity.valid) {
            this.placementGhost.setTint(0x22c55e); // Green
            this.placementBannerText.setText(`🎯 ${item.icon} ${item.name} (${item.cost} EC) — ✓ Valid Location! Click to build${this.getPlacementRotationHint(item)}`);
            this.placementBannerText.setColor('#4ade80');
        } else {
            this.placementGhost.setTint(0xef4444); // Red
            this.placementBannerText.setText(`🎯 ${item.icon} ${item.name} (${item.cost} EC) — ✗ ${validity.reason}${this.getPlacementRotationHint(item)}`);
            this.placementBannerText.setColor('#f87171');
        }
    }

    tryPlaceItem(pointer) {
        if (!this.placementMode || !this.placementMode.active) return;
        const item = this.placementMode.item;
        if (item.id === 'sapling' && !this.gameData.is2016) {
            this.showInfoPanel('Trees Are 2016 Only', 'Return to 2016 to plant or relocate trees.', 'info');
            this.cancelPlacementMode();
            return;
        }
        const worldX = Math.round(pointer.worldX);
        const worldY = Math.round(pointer.worldY);

        if (!this.gameData.is2016) {
            this.showInfoPanel('Future Era Locked', 'Cannot plan in 2026. Use Time Machine to return to 2016!', 'info');
            this.cancelPlacementMode();
            return;
        }

        if (this.gameData.ec < item.cost) {
            this.showInfoPanel('Insufficient EC', `You need ${item.cost} EC to build this.`, 'info');
            this.cancelPlacementMode();
            return;
        }

        const validity = this.checkPlacementValidity(item, worldX, worldY);
        if (!validity.valid) {
            this.cameras.main.shake(120, 0.003);
            this.placementBannerText.setText(`❌ Cannot build here! ${validity.reason}`);
            this.placementBannerText.setColor('#ef4444');
            return;
        }

        // Capture mission state before construction so completed objectives can
        // produce immediate, truthful feedback after the placement succeeds.
        const missionKeys = ['meryemHelp', 'elifHelp', 'denizHelp', 'ayseHelp', 'hasanHelp', 'zeynepHelp'];
        const progressBefore = Object.fromEntries(missionKeys.map(key => [
            key, this.buildMissionProgress(key).map(objective => objective.done)
        ]));

        // Deduct EC
        this.gameData.ec -= item.cost;
        this.hud.updateEC(this.gameData.ec);
        this.gameData.economyStats = this.gameData.economyStats || { spent: 0, builds: 0 };
        this.gameData.economyStats.spent += item.cost;
        this.gameData.economyStats.builds += 1;

        // Instantiate the permanent sprite at the exact valid point selected by
        // the player. Rooftop items must stay where they were clicked instead
        // of being snapped to the building's center.
        const placementX = worldX;
        const placementY = worldY;
        const sprite = this.add.sprite(placementX, placementY, item.texture2016);
        sprite.setRotation(this.placementMode.rotation || 0);
        const depth = item.allowedZone === 'road' ? 85 : (item.allowedZone === 'building' ? 120 : 180);
        sprite.setDepth(depth);

        this.tweens.add({
            targets: sprite,
            scale: { from: 0.3, to: 1.0 },
            duration: 250,
            ease: 'Back.easeOut'
        });

        const placedRecord = {
            id: Date.now() + Math.random(),
            item: item,
            type: item.id,
            x: placementX,
            y: placementY,
            rotation: this.placementMode.rotation || 0,
            eraBuilt: 2016,
            sprite: sprite
        };
        this.placedItems.push(placedRecord);
        if (item.id === 'busStop') this.registerFunctionalBusStop(placedRecord);

        // Update district stats
        if (item.id === 'sapling') {
            this.gameData.pastState.saplingsPlanted += 1;
            this.gameData.futureState.matureTrees += 1;
        } else if (item.id === 'busStop') {
            this.gameData.pastState.busStopsAdded += 1;
            this.gameData.futureState.busStops += 1;
        } else if (item.id === 'bikeLane') {
            this.gameData.pastState.bikeLanesAdded += 1;
            this.gameData.futureState.bikeLanes = true;
        } else if (item.id === 'fountain') {
            // Fountain acts as a rain-absorbing green element (rain gardens)
            this.gameData.pastState.rainGardensAdded += 1;
            this.gameData.futureState.rainGardens += 1;
        } else if (item.id === 'permeablePavement') {
            this.gameData.pastState.permeablePavementsAdded += 1;
            this.gameData.futureState.permeablePavements += 1;
        } else if (item.id === 'rainCollector') {
            this.gameData.pastState.rainCollectorsAdded += 1;
            this.gameData.futureState.rainCollectors += 1;
        } else if (item.id === 'waterSaving') {
            this.gameData.pastState.waterSavingAdded += 1;
            this.gameData.futureState.waterSaving += 1;
        } else if (item.id === 'droughtGreen') {
            this.gameData.pastState.droughtGreensAdded += 1;
            this.gameData.futureState.droughtGreens += 1;
        }

        if (item.coolEffect) {
            this.gameData.temperature = Math.max(26, this.gameData.temperature - (item.coolEffect * 0.2));
            this.hud.updateTemperature(this.gameData.temperature, this.gameData.is2016);
        }

        // Keep the ghost attached to the cursor after a successful placement.
        // The same item remains selected until the player cancels or presses ESC.
        if (this.placementGhost) {
            this.placementGhost.clearTint();
        }

        const toast = this.add.text(worldX, worldY - 22, `+${item.name} (-${item.cost} EC)`, {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#4ade80',
            backgroundColor: '#0f172a',
            padding: { x: 5, y: 3 }
        });
        toast.setOrigin(0.5);
        toast.setDepth(2700);
        this.tweens.add({
            targets: toast,
            y: toast.y - 30,
            alpha: 0,
            duration: 1400,
            onComplete: () => toast.destroy()
        });

        // Keep the selected infrastructure active so the player can place another
        // instance without reopening Urban Planning. The player can leave this
        // mode with Escape or the banner's Cancel button.
        this.placementMode.valid = false;
        this.showPlanningFeedback(item, worldX, worldY, progressBefore);
        this.refreshClimateDashboardIfVisible();
        if (this.eventsPanelVisible) this.refreshClimateEventsPanel();
    }

    showPlanningFeedback(item, x, y, progressBefore = {}) {
        const progress = this.characters
            .map(character => {
                const key = character.storyData?.missionKey || `${character.type}Help`;
                const before = progressBefore[key] || [];
                const after = this.buildMissionProgress(key).map(objective => objective.done);
                const newlyCompleted = after.some((done, index) => done && !before[index]);
                return { character, newlyCompleted };
            })
            .filter(entry => entry.newlyCompleted);
        const affected = progress.map(entry => entry.character.name).join(', ');
        const message = affected
            ? `${item.name} completed an objective for: ${affected}.`
            : `${item.name} is now part of the city's climate plan.`;
        const toast = this.add.text(x, y - 45, `✓ ${message}`, {
            fontSize: '11px', fontFamily: 'Arial', color: '#bbf7d0',
            backgroundColor: '#14532d', padding: { x: 6, y: 4 },
            wordWrap: { width: 260 }
        }).setOrigin(0.5);
        toast.setScrollFactor(1);
        toast.ignoreCull = true;
        toast.setDepth(2701);
        this.tweens.add({ targets: toast, y: toast.y - 18, alpha: 0, duration: 1800, onComplete: () => toast.destroy() });

        if (this.selectedCharacter) {
            this.showCharacterInfo(this.selectedCharacter);
        }
        this.notify(`✓ ${message}`, affected ? 'success' : 'info');
        if (this.climateDashboardVisible) this.refreshClimateDashboard();
        if (this.heatMapVisible) this.updateHeatMap();
    }

    updateEraFeedback() {
        if (this.eventsPanelVisible) this.refreshClimateEventsPanel();
        if (this.climateDashboardVisible) this.refreshClimateDashboard();
        if (this.selectedCharacter) this.showCharacterInfo(this.selectedCharacter);
    }

    cancelPlacementMode() {
        if (this.placementGhost) {
            this.placementGhost.destroy();
            this.placementGhost = null;
        }
        if (this.placementBanner) {
            this.placementBanner.setVisible(false);
        }
        this.placementMode = null;
    }

    getPlacementRadius(type) {
        switch (type) {
            case 'sapling':
                return 18;
            case 'shadeAwning':
                return 22;
            case 'bikeLane':
                return 28;
            case 'busStop':
                return 34;
            case 'fountain':
            case 'permeablePavement':
            case 'rainCollector':
            case 'waterSaving':
            case 'droughtGreen':
                return 34;
            case 'solarRoof':
            case 'greenRoof':
                return 36;
            default:
                return 30;
        }
    }

    getBuildingRoofCenter(worldX, worldY) {
        const buildings = [
            { x: 500, y: 420 },
            { x: 1620, y: 420 },
            { x: 1060, y: 820 },
            { x: 1620, y: 820 },
            { x: 500, y: 1220 },
            { x: 1620, y: 1220 }
        ];
        return buildings.reduce((closest, building) => {
            if (!closest) return building;
            return Math.hypot(building.x - worldX, building.y - worldY) < Math.hypot(closest.x - worldX, closest.y - worldY)
                ? building
                : closest;
        }, null);
    }

    checkPlacementValidity(item, worldX, worldY) {
        if (worldX < 100 || worldX > 2460 || worldY < 100 || worldY > 1360) {
            return { valid: false, reason: 'Outside district development borders.' };
        }

        // Check road intersections
        let inIntersection = false;
        this.roadX.forEach(rx => {
            this.roadY.forEach(ry => {
                if (Math.abs(worldX - rx) < 48 && Math.abs(worldY - ry) < 48) {
                    inIntersection = true;
                }
            });
        });
        if (inIntersection) {
            return { valid: false, reason: 'Cannot build inside road intersections!' };
        }

        // Check road segments
        let onRoad = false;
        this.roadY.forEach(ry => {
            if (Math.abs(worldY - ry) <= 36) onRoad = true;
        });
        this.roadX.forEach(rx => {
            if (Math.abs(worldX - rx) <= 36) onRoad = true;
        });

        // Check sidewalks
        let onSidewalk = false;
        this.roadY.forEach(ry => {
            const distY = Math.abs(worldY - ry);
            if (distY > 36 && distY <= 58) onSidewalk = true;
        });
        this.roadX.forEach(rx => {
            const distX = Math.abs(worldX - rx);
            if (distX > 36 && distX <= 58) onSidewalk = true;
        });

        // Check park blocks
        const inCentralPark = (worldX >= 900 && worldX <= 1220 && worldY >= 320 && worldY <= 520);
        const inSouthPark = (worldX >= 900 && worldX <= 1220 && worldY >= 1120 && worldY <= 1320);
        const inPark = inCentralPark || inSouthPark;

        // Check building rooftops
        const inBuilding = (
            (worldX >= 340 && worldX <= 660 && worldY >= 320 && worldY <= 520) || // Res Alpha
            (worldX >= 1460 && worldX <= 1780 && worldY >= 320 && worldY <= 520) || // School
            (worldX >= 900 && worldX <= 1220 && worldY >= 720 && worldY <= 920) || // Hospital
            (worldX >= 1460 && worldX <= 1780 && worldY >= 720 && worldY <= 920) || // Res Beta
            (worldX >= 340 && worldX <= 660 && worldY >= 1120 && worldY <= 1320) || // Energy Substation
            (worldX >= 1460 && worldX <= 1780 && worldY >= 1120 && worldY <= 1320) // Cooling Center
        );

        // Prevent genuine overlaps while allowing bicycle-lane segments to
        // connect end-to-end on the same road. A connected segment is valid
        // only when it is close to an existing lane, aligned with that lane's
        // road, and not placed at the exact same point.
        const newRadius = this.getPlacementRadius(item.id);
        const buffer = 8;
        const hasOverlap = (this.placedItems || []).some(p => {
            const dx = worldX - p.x;
            const dy = worldY - p.y;
            const dist = Math.hypot(dx, dy);
            const existingRadius = this.getPlacementRadius(p.type);
            const overlaps = dist < (newRadius + existingRadius + buffer);

            if (!overlaps) return false;
            if (item.id !== 'bikeLane' || p.type !== 'bikeLane') return true;
            if (dist < 12 || dist > 110) return true;

            const sameHorizontalRoad = Math.abs(worldY - p.y) <= 12;
            const sameVerticalRoad = Math.abs(worldX - p.x) <= 12;
            return !(sameHorizontalRoad || sameVerticalRoad);
        });

        if (hasOverlap) {
            return { valid: false, reason: 'Overlapping placement is not allowed.' };
        }

        // Validation by allowedZone
        if (item.allowedZone === 'sidewalk') {
            if (onSidewalk) return { valid: true };
            return { valid: false, reason: 'Must be placed on a sidewalk beside the street.' };
        }

        if (item.allowedZone === 'sidewalk_or_park') {
            if (onSidewalk || inPark) return { valid: true };
            return { valid: false, reason: 'Must be placed on a sidewalk or inside a park.' };
        }

        if (item.allowedZone === 'road') {
            if (onRoad && !inIntersection) return { valid: true };
            return { valid: false, reason: 'Must be painted along a road lane.' };
        }

        if (item.allowedZone === 'building') {
            if (inBuilding) {
                const roofCenter = this.getBuildingRoofCenter(worldX, worldY);
                return {
                    valid: true,
                    roofCenter,
                    reason: 'Valid building rooftop.'
                };
            }
            return { valid: false, reason: 'Must be installed on a building rooftop.' };
        }

        if (item.allowedZone === 'park') {
            if (inPark) return { valid: true };
            return { valid: false, reason: 'Must be placed inside a green park or garden.' };
        }

        return { valid: true };
    }

    openTimeMachinePanel() {
        const eraName = this.gameData.is2016 ? '2016 (Past)' : '2026 (Present)';
        let text = `Current Era: ${eraName}\n`;
        text += `Charges: ${this.gameData.tmCharges}/${this.gameData.maxTmCharges} (Cost: 1)\n\n`;
        text += `Temporal Status:\n`;
        text += `• Mature Trees (2026): ${this.gameData.futureState.matureTrees}\n`;
        text += `• Bus Stops: ${this.gameData.futureState.busStops}\n`;
        text += `• Parking Lots: ${this.gameData.futureState.parkingLots}`;
        const economy = this.gameData.economyStats || { spent: 0, builds: 0, missionRewards: 0 };
        text += `\n\nEconomy Balance:\n• Current EC: ${this.gameData.ec}\n• Infrastructure built: ${economy.builds || 0}\n• EC spent: ${economy.spent || 0}\n• Mission rewards: ${economy.missionRewards || 0}`;

        this.showInfoPanel('Time Machine Portal', text, 'timeMachine');
    }

    travelEra() {
        // Keep one charge reserved for the return journey when leaving 2016.
        const requiredCharges = this.gameData.is2016
            ? Math.max(2, this.gameData.climateEvents?.active ? 2 : 1)
            : 1;
        if (this.gameData.tmCharges < requiredCharges) {
            const message = this.gameData.is2016
                ? 'You need at least 2 charges to travel from 2016: one for this trip and one reserved for returning safely.'
                : 'You have 0 charges left! Buy a charge pack to travel safely.';
            this.showInfoPanel('Time Machine Locked', message, 'info');
            return;
        }

        if (this.placementMode && this.placementMode.active) {
            this.cancelPlacementMode();
        }

        this.gameData.tmCharges -= 1;
        this.gameData.is2016 = !this.gameData.is2016;

        this.hud.updateTimeMachineCharges(this.gameData.tmCharges, this.gameData.maxTmCharges);
        this.hud.updateEra(this.gameData.is2016);

        this.cameras.main.flash(400, 56, 189, 248);
        this.locations.forEach(loc => loc.updateEraVisual(this.gameData.is2016));

        // 6. Temporal Persistence: Evolve placed objects (e.g. saplings mature into shade trees)
        if (this.placedItems) {
            this.placedItems.forEach(item => {
                if (item.type === 'sapling' && item.sprite) {
                    item.sprite.setTexture(this.gameData.is2016 ? item.item.texture2016 : item.item.texture2026);
                }
            });
        }

        // If urban planning panel is open, refresh lock status
        if (this.urbanPlanningPanelVisible) {
            this.renderUrbanPlanningCards();
        }

        const eraName = this.gameData.is2016 ? '2016 (Past)' : '2026 (Present)';
        this.showInfoPanel('Time Travel Successful', `Arrived in ${eraName}.\nRemaining charges: ${this.gameData.tmCharges}/${this.gameData.maxTmCharges}`, 'info');
        if (this.eventsPanelVisible) this.refreshClimateEventsPanel();
        if (!this.gameData.is2016 && this.gameData.climateEvents.active) {
            this.maybeAnnounceActiveClimateEvent();
        }
        this.refreshClimateDashboardIfVisible();
        this.updateEraFeedback();
    }

    buyChargePack() {
        if (this.gameData.ec >= this.gameData.chargePackCost) {
            const beforeCharges = this.gameData.tmCharges;
            this.gameData.ec -= this.gameData.chargePackCost;
            this.gameData.economyStats = this.gameData.economyStats || { spent: 0, builds: 0 };
            this.gameData.economyStats.spent += this.gameData.chargePackCost;
            this.gameData.tmCharges = Math.min(this.gameData.maxTmCharges, this.gameData.tmCharges + 4);
            this.hud.updateEC(this.gameData.ec);
            this.gameData.economyStats.lastChargePack = {
                purchasedAt: Date.now(),
                chargesBefore: beforeCharges,
                chargesAfter: this.gameData.tmCharges
            };
            this.hud.updateTimeMachineCharges(this.gameData.tmCharges, this.gameData.maxTmCharges);
            this.showInfoPanel('Purchase Successful', 'Bought +4 Time Machine charges!', 'info');
        } else {
            this.showInfoPanel('Not Enough EC', 'You need 40 EC to buy a charge pack.', 'info');
        }
    }

    getMissionGuidance(missionKey) {
        const guidance = {
            meryemHelp: [
                'Place a Bus Stop on a sidewalk within walking distance of Meryem\'s home.',
                'Plant at least two saplings along her route to create shade.'
            ],
            elifHelp: [
                'Plant a sapling near the school walking route.',
                'Place a Shade Awning near the school for children walking on hot days.'
            ],
            denizHelp: [
                'Paint at least two connected Bike Lane segments on suitable roads.',
                'Extend the Bike Lane network to at least four connected segments.'
            ],
            ayseHelp: [
                'Plant at least three saplings in Ayşe\'s neighborhood.',
                'Install a Green Roof on a suitable building.',
                'Add a Shade Awning or plant two more saplings to create a cooler public area.'
            ],
            hasanHelp: [
                'Place a Cooling Fountain to act as a rain garden near Hasan\'s shop.',
                'Add Permeable Pavement on a nearby road.',
                'Place a Rainwater Collector near the affected commercial area.'
            ],
            zeynepHelp: [
                'Place a Rainwater Collector near Zeynep\'s neighborhood.',
                'Install Water-Saving Infrastructure on a suitable building.',
                'Add Drought-Resistant Greens near the neighborhood.'
            ]
        };
        return guidance[missionKey] || [];
    }

    completeMission(missionKey) {
        const rewards = {
            meryemHelp: 35, denizHelp: 40, elifHelp: 45,
            ayseHelp: 50, hasanHelp: 40, zeynepHelp: 45
        };
        const reward = rewards[missionKey];

        if (this.gameData.missions[missionKey]) {
            this.showInfoPanel('Mission Complete', 'Already completed.', 'info');
            return;
        }

        // Verify the actual mission requirements before allowing completion.
        const progress = this.buildMissionProgress(missionKey);
        if (progress.length > 0 && !progress.every(p => p.done)) {
            const remaining = progress.filter(p => !p.done).length;
            const guidance = this.getMissionGuidance(missionKey)
                .filter((step, index) => !progress[index]?.done)
                .map(step => `• ${step}`)
                .join('\n');
            this.showInfoPanel(
                'Mission Not Ready',
                `${remaining} objective(s) still need attention.\n\n${guidance}\n\nBuild these improvements in 2016, then return here and check the mission again.`,
                'info'
            );
            return;
        }

        this.gameData.missions[missionKey] = true;
        this.gameData.climateMemory = this.gameData.climateMemory || {};
        this.gameData.climateMemory[missionKey] = {
            completedAt: Date.now(),
            era: this.gameData.is2016 ? 2016 : 2026,
            infrastructureCount: this.placedItems.length
        };
        this.gameData.ec += reward;
        this.gameData.economyStats = this.gameData.economyStats || { spent: 0, builds: 0 };
        this.gameData.economyStats.missionRewards = (this.gameData.economyStats.missionRewards || 0) + reward;
        this.hud.updateEC(this.gameData.ec);
        this.showInfoPanel('Mission Accomplished!', `Reward: +${reward} Eco Credits (EC).\n\nThe resident's life has improved thanks to your planning.\n\nClimate memory updated: their dialogue and wellbeing now reflect this decision.`, 'info');
        this.notify(`Mission complete: +${reward} EC reward.`, 'success');
        this.refreshClimateDashboardIfVisible();
    }

    createRoadsAndCrosswalks() {
        const bg = this.add.rectangle(1280, 720, 2560, 1440, 0x1e293b);
        bg.setDepth(-10);

        // Horizontal roads & sidewalks
        this.roadY.forEach(y => {
            const road = this.add.rectangle(1280, y, 2560, 80, 0x334155);
            road.setDepth(-5);
            // Center yellow dividing line
            for (let x = 10; x < 2560; x += 40) {
                this.add.rectangle(x, y, 20, 3, 0xfacc15, 0.7).setDepth(-4);
            }
            // Sidewalks
            this.add.rectangle(1280, y - 48, 2560, 16, 0x94a3b8, 0.7).setDepth(-6);
            this.add.rectangle(1280, y + 48, 2560, 16, 0x94a3b8, 0.7).setDepth(-6);
        });

        // Vertical roads & sidewalks
        this.roadX.forEach(x => {
            const road = this.add.rectangle(x, 720, 80, 1440, 0x334155);
            road.setDepth(-5);
            for (let y = 10; y < 1440; y += 40) {
                this.add.rectangle(x, y, 3, 20, 0xfacc15, 0.7).setDepth(-4);
            }
            this.add.rectangle(x - 48, 720, 16, 1440, 0x94a3b8, 0.7).setDepth(-6);
            this.add.rectangle(x + 48, 720, 16, 1440, 0x94a3b8, 0.7).setDepth(-6);
        });

        // Zebra Pedestrian Crosswalks at all intersections
        this.roadX.forEach(cx => {
            this.roadY.forEach(cy => {
                for (let i = -36; i <= 36; i += 12) {
                    this.add.rectangle(cx + i, cy - 48, 6, 16, 0xffffff, 0.9).setDepth(-3);
                    this.add.rectangle(cx + i, cy + 48, 6, 16, 0xffffff, 0.9).setDepth(-3);
                    this.add.rectangle(cx - 48, cy + i, 16, 6, 0xffffff, 0.9).setDepth(-3);
                    this.add.rectangle(cx + 48, cy + i, 16, 6, 0xffffff, 0.9).setDepth(-3);
                }
            });
        });
    }

    createPlannedCityBlocks() {
        this.locations = [];

        const cityBlocks = [
            { id: 1, name: 'Mediterranean Apartments Alpha', x: 500, y: 420, type: 'residential', description: 'Dense residential apartment complex. Meryem lives here.' },
            { id: 2, name: 'Sunrise Central Park', x: 1060, y: 420, type: 'park', description: 'Lush greenery, trees, walking paths, and cooling zone.' },
            { id: 3, name: 'Neighborhood School Campus', x: 1620, y: 420, type: 'school', description: 'District educational academy & shaded campus.' },

            { id: 4, name: 'Central District Parking Lot', x: 500, y: 820, type: 'parkingLot', description: 'Public parking ground with parked cars.' },
            { id: 5, name: 'Metropolitan Hospital', x: 1060, y: 820, type: 'hospital', description: 'Central hospital and medical cooling refuge.' },
            { id: 6, name: 'Apartment Blocks Beta', x: 1620, y: 820, type: 'residential', description: 'Multi-story apartment units. Elif lives here.' },

            { id: 7, name: 'Clean Energy Substation', x: 500, y: 1220, type: 'energyStation', description: 'District smart power grid station.' },
            { id: 8, name: 'South Community Park', x: 1060, y: 1220, type: 'park', description: 'Open garden and shaded resting haven.' },
            { id: 9, name: 'Cooling Center Haven', x: 1620, y: 1220, type: 'coolingCenter', description: 'Climate-controlled emergency cooling sanctuary.' }
        ];

        cityBlocks.forEach(blk => {
            const location = new Location(this, blk.id, blk.name, blk.x, blk.y, blk.type, blk.description);
            location.create();
            this.locations.push(location);
        });
    }

    // 2. Bus Stops: Reduced number (4 stops serving the 9 blocks along sidewalks)
    createBusStops() {
        this.busStopsData = [
            { id: 101, name: 'Bus Stop Alpha Promenade', x: 600, y: 268 },
            { id: 102, name: 'Bus Stop Campus East', x: 1600, y: 268 },
            { id: 103, name: 'Bus Stop Medical Plaza', x: 1040, y: 572 },
            { id: 104, name: 'Bus Stop South Gardens', x: 1040, y: 1068 }
        ];

        this.busStopsData.forEach(stop => {
            const loc = new Location(this, stop.id, stop.name, stop.x, stop.y, 'busStop', 'Public transit stop connecting district neighborhoods.');
            loc.create();
            this.locations.push(loc);

            // Spawn 2 waiting passengers on sidewalk beside bus shelter
            stop.waitingPassengers = [];
            [-14, 14].forEach(offsetX => {
                const ped = this.add.sprite(stop.x + offsetX, stop.y, 'ped_general');
                ped.setDepth(210);
                stop.waitingPassengers.push(ped);
            });
        });
    }

    // 3. Working Public Transit Bus System (Line 42)
    createTransitBus() {
        // Designated route adhering strictly to right-hand traffic lanes connecting all stops
        this.busRoute = [
            { x: 600, y: 240, stopId: 101, stopName: 'Alpha Promenade' },
            { x: 1600, y: 240, stopId: 102, stopName: 'Campus East' },
            { x: 1880, y: 240 },
            { x: 1880, y: 600 },
            { x: 1040, y: 600, stopId: 103, stopName: 'Medical Plaza' },
            { x: 760, y: 600 },
            { x: 760, y: 1040 },
            { x: 1040, y: 1040, stopId: 104, stopName: 'South Gardens' },
            { x: 1920, y: 1040 },
            { x: 1920, y: 200 },
            { x: 240, y: 200 },
            { x: 240, y: 240 }
        ];

        const startWp = this.busRoute[0];
        const sprite = this.add.sprite(startWp.x, startWp.y, 'bus_transit');
        sprite.setDepth(240);
        sprite.setAngle(0);

        const statusText = this.add.text(startWp.x, startWp.y - 22, '🚌 Line 42', {
            fontSize: '11px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            backgroundColor: '#0f172a',
            padding: { x: 4, y: 2 }
        });
        statusText.setOrigin(0.5);
        statusText.setDepth(241);

        this.transitBus = {
            sprite: sprite,
            statusText: statusText,
            currentWaypointIndex: 0,
            nextWaypointIndex: 1,
            speed: 1.25,
            state: 'driving', // 'driving', 'boarding'
            stopTimer: 0,
            passengerCount: 3,
            axis: 'h',
            dir: 1
        };
    }

    handleBusArrivalAtStop(bus, waypoint) {
        bus.state = 'boarding';
        bus.stopTimer = 3.0; // Dwell time at stop
        bus.statusText.setText(`🚏 Boarding [${waypoint.stopName}]`);
        bus.statusText.setColor('#facc15');

        // Find the bus stop
        const stop = this.busStopsData?.find(s => s.id === waypoint.stopId);
        if (stop && stop.waitingPassengers && stop.waitingPassengers.length > 0) {
            // Board waiting passengers into bus
            stop.waitingPassengers.forEach((pedSprite, idx) => {
                this.tweens.add({
                    targets: pedSprite,
                    x: bus.sprite.x,
                    y: bus.sprite.y,
                    alpha: 0,
                    duration: 500 + (idx * 200),
                    onComplete: () => {
                        pedSprite.destroy();
                        bus.passengerCount += 1;
                    }
                });
            });
            stop.waitingPassengers = [];
        }

        // Disembark 1-2 passengers onto the sidewalk
        if (bus.passengerCount > 1) {
            const disembarkCount = Phaser.Math.Between(1, 2);
            for (let i = 0; i < disembarkCount; i++) {
                bus.passengerCount = Math.max(0, bus.passengerCount - 1);
                const disembarkPed = this.add.sprite(bus.sprite.x, bus.sprite.y, 'ped_general');
                disembarkPed.setDepth(220);

                        const targetSidewalkY = stop ? stop.y : (bus.sprite.y + 24);
                this.tweens.add({
                    targets: disembarkPed,
                    x: bus.sprite.x + Phaser.Math.Between(-25, 25),
                    y: targetSidewalkY,
                    duration: 600,
                    onComplete: () => {
                        if (this.pedestrians) {
                            this.pedestrians.push({
                                sprite: disembarkPed,
                                vx: Phaser.Math.RND.pick([-1, 1]) * 0.6,
                                vy: 0,
                                speed: 0.6,
                                axis: 'h',
                                sideOffset: 48
                            });
                        }
                    }
                });
            }
        }
    }

    setupPassengerSpawnTimer() {
        this.time.addEvent({
            delay: 15000,
            loop: true,
            callback: () => {
                if (!this.busStopsData) return;
                const emptyStop = this.busStopsData.find(s => !s.waitingPassengers || s.waitingPassengers.length === 0);
                if (emptyStop) {
                    const ped = this.add.sprite(emptyStop.x + Phaser.Math.Between(-14, 14), emptyStop.y, 'ped_general');
                    ped.setDepth(210);
                    if (!emptyStop.waitingPassengers) emptyStop.waitingPassengers = [];
                    emptyStop.waitingPassengers.push(ped);
                }
            }
        });
    }

    // 1. Two-Way Traffic with Right-Hand Drive Rule
    createTwoWayTraffic() {
        this.cars = [];
        const carTextures = ['car_red', 'car_blue', 'car_yellow'];
        const numCars = 12;

        for (let i = 0; i < numCars; i++) {
            const isHorizontal = i % 2 === 0;
            const currentRoadY = Phaser.Math.RND.pick(this.roadY);
            const currentRoadX = Phaser.Math.RND.pick(this.roadX);

            // Direction: 1 or -1
            const dir = Phaser.Math.RND.pick([1, -1]);
            const speed = 1.5;

            // Lane offset from road center:
            // For Right-Hand Traffic:
            // Moving East (+X, dir=1): right lane is South (Y + 20)
            // Moving West (-X, dir=-1): right lane is North (Y - 20)
            // Moving South (+Y, dir=1): right lane is West (X - 20)
            // Moving North (-Y, dir=-1): right lane is East (X + 20)
            let x, y, vx, vy, angle;

            if (isHorizontal) {
                y = currentRoadY + (dir === 1 ? 20 : -20);
                x = Phaser.Math.Between(250, 2200);
                vx = dir * speed;
                vy = 0;
                angle = dir === 1 ? 0 : 180;
            } else {
                x = currentRoadX + (dir === 1 ? -20 : 20);
                y = Phaser.Math.Between(250, 1200);
                vx = 0;
                vy = dir * speed;
                angle = dir === 1 ? 90 : 270;
            }

            const carSprite = this.add.sprite(x, y, Phaser.Math.RND.pick(carTextures));
            carSprite.setDepth(200);
            carSprite.setAngle(angle);

            this.cars.push({
                sprite: carSprite,
                roadY: currentRoadY,
                roadX: currentRoadX,
                axis: isHorizontal ? 'h' : 'v',
                dir: dir,
                speed: speed,
                vx: vx,
                vy: vy
            });
        }
    }

    createSidewalkPedestrians() {
        this.pedestrians = [];

        for (let i = 0; i < 20; i++) {
            const isHorizontal = i % 2 === 0;
            const roadY = Phaser.Math.RND.pick(this.roadY);
            const roadX = Phaser.Math.RND.pick(this.roadX);
            const sideOffset = Phaser.Math.RND.pick([-48, 48]);

            const x = isHorizontal ? Phaser.Math.Between(250, 2100) : (roadX + sideOffset);
            const y = isHorizontal ? (roadY + sideOffset) : Phaser.Math.Between(250, 1200);

            const pedSprite = this.add.sprite(x, y, 'ped_general');
            pedSprite.setDepth(220);

            const speed = 0.6;
            const dir = Phaser.Math.RND.pick([-1, 1]);

            this.pedestrians.push({
                sprite: pedSprite,
                vx: isHorizontal ? dir * speed : 0,
                vy: !isHorizontal ? dir * speed : 0,
                speed: speed,
                axis: isHorizontal ? 'h' : 'v',
                sideOffset: sideOffset
            });
        }
    }

    createCharacters() {
        this.characters = [];
        const characters = [
            {
                id: 1, name: 'Meryem Nine', x: 440, y: 380, type: 'meryem',
                intro: 'A retired elderly woman living in Mediterranean Apartments Alpha.',
                story: 'Meryem needs to visit the hospital regularly for her health. Her home is far from the nearest bus stop.',
                problem2026: 'I still have to wait for my daughter whenever I need to go to the hospital. Walking to the bus stop in this heat is exhausting.',
                cause: 'There is no nearby public transportation, and walking routes lack shade.',
                objectives: ['Place a bus stop near her home (sidewalk)', 'Add shade trees along the walking route'],
                outcome: 'Meryem can reach the hospital independently without relying on her daughter.',
                missionKey: 'meryemHelp'
            },
            {
                id: 2, name: 'Elif', x: 1600, y: 840, type: 'elif',
                intro: 'A mother whose child walks to the Neighborhood School Campus every day.',
                story: 'In 2026, the school route has very little shade. Walking on hot days is uncomfortable and unsafe for children.',
                problem2026: 'On hot days, the walk to school is still exhausting. There is no shade anywhere.',
                cause: 'The walking route to school lacks trees and shade structures.',
                objectives: ['Plant trees along the school route in 2016', 'Add shade awnings on sidewalks near the school'],
                outcome: 'The school route becomes shaded and comfortable for children.',
                missionKey: 'elifHelp'
            },
            {
                id: 3, name: 'Deniz', x: 1060, y: 480, type: 'deniz',
                intro: 'A delivery worker who wants to use a bicycle for short-distance deliveries.',
                story: 'In 2026, traffic is heavy and short journeys require cars. Deniz cannot safely travel by bicycle.',
                problem2026: 'I still have to share the road with cars. It is not safe enough for cycling.',
                cause: 'Bicycle infrastructure is missing across the district.',
                objectives: ['Paint bicycle lanes along suitable roads', 'Improve connections between key destinations'],
                outcome: 'Deniz delivers safely by bicycle, reducing the city\'s carbon footprint.',
                missionKey: 'denizHelp'
            },
            {
                id: 4, name: 'Ayşe', x: 1060, y: 420, type: 'ayse',
                humanIcon: '👤',
                intro: 'A resident of a densely built neighborhood with very little greenery.',
                story: 'Concrete and asphalt absorb heat, making her neighborhood uncomfortable, especially during summer nights.',
                problem2026: 'Our neighborhood is still a concrete oven. There is nowhere pleasant outside.',
                cause: 'Lack of green spaces, trees, and green roofs in the built-up area.',
                objectives: ['Plant trees in the neighborhood', 'Add green roofs to suitable buildings', 'Create shaded public spaces'],
                outcome: 'The neighborhood becomes cooler with more green coverage.',
                missionKey: 'ayseHelp'
            },
            {
                id: 5, name: 'Hasan', x: 500, y: 820, type: 'hasan',
                humanIcon: '👤',
                intro: 'A shop owner in a neighborhood that floods during heavy rainfall.',
                story: 'Streets have insufficient permeable surfaces and poor rainwater management.',
                problem2026: 'Heavy rain still makes me worry about losing everything in my shop.',
                cause: 'Insufficient drainage and permeable surfaces in the commercial area.',
                objectives: ['Create rain gardens', 'Introduce permeable pavement', 'Add rainwater collection infrastructure'],
                outcome: 'Flood risk is reduced and Hasan\'s shop is protected.',
                missionKey: 'hasanHelp'
            },
            {
                id: 6, name: 'Zeynep', x: 500, y: 1220, type: 'zeynep',
                humanIcon: '👤',
                intro: 'A resident affected by water shortages during dry periods.',
                story: 'Water is wasted and the neighborhood lacks rainwater collection infrastructure.',
                problem2026: 'We are still not prepared for dry periods. Water is scarce.',
                cause: 'Insufficient rainwater harvesting and water-saving infrastructure.',
                objectives: [
                    'Add rainwater harvesting systems',
                    'Introduce water-saving infrastructure',
                    'Introduce drought-resistant green spaces'
                ],
                outcome: 'Water security improves and the neighborhood becomes drought-resilient.',
                missionKey: 'zeynepHelp'
            }
        ];

        characters.forEach(chr => {
            const description = chr.intro;
            const character = new Character(this, chr.id, chr.name, chr.x, chr.y, chr.type, description, chr);
            character.create();
            this.characters.push(character);
        });
    }

    createInfoPanel() {
        this.panelX = 180;
        this.panelY = 590;

        this.infoPanelBg = this.add.rectangle(this.panelX, this.panelY, 340, 220, 0x0f172a, 0.95);
        this.infoPanelBg.setOrigin(0.5);
        this.infoPanelBg.setScrollFactor(0);
        this.infoPanelBg.ignoreCull = true;
        this.infoPanelBg.setDepth(10000);

        this.infoPanelBorder = this.add.rectangle(this.panelX, this.panelY, 344, 224, 0x38bdf8, 1);
        this.infoPanelBorder.setOrigin(0.5);
        this.infoPanelBorder.setScrollFactor(0);
        this.infoPanelBorder.ignoreCull = true;
        // The border is a larger rectangle behind the dark panel, not a fill above it.
        this.infoPanelBorder.setDepth(9999);

        this.infoTitle = this.add.text(this.panelX - 150, this.panelY - 95, '', {
            fontSize: '19px',
            fontFamily: 'Arial',
            color: '#7dd3fc',
            fontStyle: 'bold'
        });
        this.infoTitle.setScrollFactor(0);
        this.infoTitle.ignoreCull = true;
        this.infoTitle.setDepth(10002);

        this.infoMaskWidth = 310;
        this.infoMaskHeight = 120;

        this.infoBodyContainer = this.add.container(this.panelX - 150, this.panelY - 65);
        this.infoBodyContainer.setDepth(10002);
        this.infoBodyContainer.setScrollFactor(0);
        this.infoBodyContainer.ignoreCull = true;

        this.infoBody = this.add.text(0, 0, '', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#f1f5f9',
            lineSpacing: 4,
            wordWrap: { width: this.infoMaskWidth }
        });
        this.infoBody.setScrollFactor(0);
        this.infoBody.ignoreCull = true;
        this.infoBody.setDepth(10003);
        this.infoBodyContainer.add(this.infoBody);

        // Mask (clipping) so text stays inside a scrollable viewport
        const maskGfx = this.make.graphics({ x: this.panelX - 150, y: this.panelY - 65, add: false });
        maskGfx.setScrollFactor(0);
        maskGfx.ignoreCull = true;
        maskGfx.fillStyle(0xffffff, 1);
        maskGfx.fillRect(0, 0, this.infoMaskWidth, this.infoMaskHeight);
        const infoGeometryMask = maskGfx.createGeometryMask();
        infoGeometryMask.camera = this.cameras.main;
        this.infoBodyContainer.setMask(infoGeometryMask);
        this.infoBodyContainer.ignoreCull = true;

        // Scroll state/buttons
        this.infoScrollOffset = 0;
        this.infoScrollMax = 0;

        this.infoScrollUpBtn = this.add.text(this.panelX + 120, this.panelY - 35, '▲', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            backgroundColor: '#1e293b',
            padding: { x: 6, y: 3 }
        });
        this.infoScrollUpBtn.setScrollFactor(0);
        this.infoScrollUpBtn.setDepth(10004);
        this.infoScrollUpBtn.setInteractive({ useHandCursor: true });
        this.infoScrollUpBtn.on('pointerdown', () => this.scrollInfo(-40));
        this.infoScrollUpBtn.setVisible(false);

        this.infoScrollDownBtn = this.add.text(this.panelX + 120, this.panelY + 45, '▼', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#38bdf8',
            backgroundColor: '#1e293b',
            padding: { x: 6, y: 3 }
        });
        this.infoScrollDownBtn.setScrollFactor(0);
        this.infoScrollDownBtn.setDepth(10004);
        this.infoScrollDownBtn.setInteractive({ useHandCursor: true });
        this.infoScrollDownBtn.on('pointerdown', () => this.scrollInfo(40));
        this.infoScrollDownBtn.setVisible(false);

        this.actionBtn1 = this.createActionButton(this.panelX - 150, this.panelY + 65, '🚀 Travel Era', '#38bdf8', () => this.travelEra());
        this.actionBtn2 = this.createActionButton(this.panelX - 25, this.panelY + 65, '🪙 Buy Charges', '#facc15', () => this.buyChargePack());
        this.actionBtnMission = this.createActionButton(this.panelX - 130, this.panelY + 65, '🤝 Complete Mission', '#a855f7', () => this.completeMission('meryemHelp'));

        this.closeBtn = this.add.text(this.panelX + 130, this.panelY - 100, '✕', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#f43f5e',
            backgroundColor: '#1e293b',
            padding: { x: 6, y: 2 }
        });
        this.closeBtn.setScrollFactor(0);
        this.closeBtn.setDepth(10004);
        this.closeBtn.setInteractive({ useHandCursor: true });
        this.closeBtn.on('pointerdown', () => this.hideInfoPanel());
    }

    // 6. Climate Dashboard (Phase 4)
    createClimateDashboard() {
        const camW = this.cameras.main.width;
        const camH = this.cameras.main.height;

        // Compact top-right panel, overlaying the map
        const panelW = Math.min(520, camW - 20);
        // Keep the six rows readable while leaving a reliable close target.
        const panelH = Math.min(520, camH - 90);
        const x = Math.max(10, camW - panelW - 10);
        const y = 78;

        this.climatePanel = this.add.container(x, y);
        this.climatePanel.setScrollFactor(0);
        this.climatePanel.setDepth(2700);
        this.climatePanel.setScrollFactor(0);
        this.climatePanel.ignoreCull = true;
        this.climatePanel.setVisible(false);
        this.climatePanel.setActive(false);

        const bg = this.add.rectangle(panelW / 2, panelH / 2, panelW, panelH, 0x0f172a, 0.96);
        bg.setDepth(1);
        bg.setScrollFactor(0);
        bg.ignoreCull = true;
        bg.setInteractive();
        bg.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
        });

        const border = this.add.rectangle(panelW / 2, panelH / 2, panelW + 4, panelH + 4, 0x38bdf8, 1);
        border.setDepth(-1);

        const title = this.add.text(panelW / 2, 10, '📊 Climate Dashboard', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#7dd3fc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const close = this.add.text(panelW - 18, 8, '✕ Close', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#f43f5e',
            backgroundColor: '#1e293b',
            padding: { x: 4, y: 1 }
        }).setOrigin(1, 0);
        close.setDepth(30);
        close.setInteractive({ useHandCursor: true });
        close.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            this.toggleClimateDashboard(false);
        });

        this.heatMapButton = this.add.text(panelW - 112, 31, 'Heat Map: Off', {
            fontSize: '11px',
            fontFamily: 'Arial',
            color: '#0f172a',
            backgroundColor: '#64748b',
            padding: { x: 6, y: 4 }
        }).setOrigin(1, 0);
        this.heatMapButton.setDepth(30);
        this.heatMapButton.setInteractive({ useHandCursor: true });
        this.heatMapButton.on('pointerdown', (pointer) => {
            if (pointer && pointer.event) pointer.event.stopPropagation();
            this.toggleHeatMap();
        });

        // Disclaimer / era line (kept short)
        this.climateEraText = this.add.text(14, 30, '', {
            fontSize: '10px',
            fontFamily: 'Arial',
            color: '#94a3b8'
        }).setOrigin(0, 0);

        this.heatMapLegend = this.add.text(14, panelH - 24,
            'Heat risk:  🟩 low   🟨 moderate   🟧 high   🟥 critical', {
                fontSize: '10px',
                fontFamily: 'Arial',
                color: '#cbd5e1'
            }).setOrigin(0, 0.5);
        this.heatMapLegend.setVisible(false);

        this.climateCompareText = this.add.text(14, panelH - 43, '', {
            fontSize: '9px', fontFamily: 'Arial', color: '#94a3b8'
        });
        this.climateCompareText.setVisible(false);

        this.climatePanel.add([
            border, bg, title, close, this.heatMapButton,
            this.climateEraText, this.heatMapLegend, this.climateCompareText
        ]);
        [border, title, close, this.heatMapButton, this.climateEraText, this.heatMapLegend, this.climateCompareText].forEach(element => {
            element.setScrollFactor(0);
            element.ignoreCull = true;
        });
        // Child input objects are explicitly fixed and ordered above the backdrop.
        close.setDepth(30);
        this.heatMapButton.setDepth(30);

        const indicators = [
            { id: 'urbanHeat', label: 'Urban Heat Risk', higherIsBetter: false },
            { id: 'waterSecurity', label: 'Water Security', higherIsBetter: true },
            { id: 'cleanEnergy', label: 'Clean Energy', higherIsBetter: true },
            { id: 'carbonFootprint', label: 'Carbon Footprint', higherIsBetter: false },
            { id: 'climateEquity', label: 'Climate Equity', higherIsBetter: true },
            { id: 'wellbeing', label: 'Resident Wellbeing', higherIsBetter: true }
        ];

        const pad = 14;
        const rowTop = 42;
        const rowH = Math.floor((panelH - rowTop - 8) / indicators.length);
        const barW = panelW - pad * 2;
        const barH = 8;

        this.climateIndicatorRows = {};

        indicators.forEach((ind, idx) => {
            const rowY = rowTop + idx * rowH;

            const label = this.add.text(pad, rowY, ind.label, {
                fontSize: '12px',
                fontFamily: 'Arial',
                color: '#f1f5f9',
                fontStyle: 'bold'
            }).setOrigin(0, 0);

            const scoreText = this.add.text(pad + barW, rowY, '0', {
                fontSize: '10px',
                fontFamily: 'Arial',
                color: '#f8fafc',
                fontStyle: 'bold'
            }).setOrigin(1, 0);

            const barBg = this.add.rectangle(pad + barW / 2, rowY + 16, barW, barH, 0x334155, 1);
            barBg.setStrokeStyle(1, 0x0f172a);

            const fill = this.add.rectangle(pad, rowY + 16, 0, barH, 0x22c55e, 1);
            fill.setOrigin(0, 0.5);

            const status = this.add.text(pad, rowY + 28, '', {
                fontSize: '10px',
                fontFamily: 'Arial',
                color: '#cbd5e1',
                wordWrap: { width: barW }
            }).setOrigin(0, 0);

            // Indicator rows are display-only. Only the dashboard backdrop and
            // explicit controls (Close / Heat Map) should participate in hit testing.
            [label, scoreText, barBg, fill, status].forEach(element => {
                element.setScrollFactor(0);
                element.ignoreCull = true;
            });
            label.setDepth(5);
            scoreText.setDepth(5);

            this.climatePanel.add([label, scoreText, barBg, fill, status]);

            this.climateIndicatorRows[ind.id] = {
                label,
                scoreText,
                barBg,
                fill,
                status,
                higherIsBetter: ind.higherIsBetter
            };
        });

        this.refreshClimateDashboard();
    }

    createNotificationBanner() {
        this.notificationQueue = [];
        this.notificationActive = false;
        this.notificationPanel = this.add.container(640, 128);
        this.notificationPanel.setScrollFactor(0);
        this.notificationPanel.setDepth(3200);
        this.notificationPanel.setVisible(false);

        const bg = this.add.rectangle(0, 0, 460, 54, 0x14532d, 0.96);
        bg.setStrokeStyle(1, 0x4ade80);
        const text = this.add.text(-210, 0, '', {
            fontSize: '12px', fontFamily: 'Arial', color: '#dcfce7',
            wordWrap: { width: 365 }
        }).setOrigin(0, 0.5);
        const close = this.add.text(220, 0, '✕', {
            fontSize: '14px', color: '#bbf7d0', backgroundColor: '#166534', padding: { x: 5, y: 2 }
        }).setOrigin(1, 0.5);
        close.setInteractive({ useHandCursor: true });
        close.on('pointerdown', pointer => {
            pointer?.event?.stopPropagation();
            this.dismissNotification();
        });
        this.notificationText = text;
        this.notificationPanel.add([bg, text, close]);
    }

    notify(message, tone = 'success', duration = 2600) {
        this.notificationQueue.push({ message, tone, duration });
        this.showNextNotification();
    }

    showNextNotification() {
        if (this.notificationActive || !this.notificationQueue.length) return;
        const next = this.notificationQueue.shift();
        this.notificationActive = true;
        this.notificationText.setText(next.message);
        this.notificationPanel.setVisible(true);
        const color = next.tone === 'warning' ? 0x78350f : next.tone === 'info' ? 0x0c4a6e : 0x14532d;
        this.notificationPanel.first.setFillStyle(color, 0.96);
        this.notificationTimer = this.time.delayedCall(next.duration, () => this.dismissNotification());
    }

    dismissNotification() {
        if (!this.notificationActive) return;
        if (this.notificationTimer) this.notificationTimer.remove(false);
        this.notificationPanel.setVisible(false);
        this.notificationActive = false;
        this.showNextNotification();
    }

    createClimateEventsPanel() {
        this.eventsPanelVisible = false;
        const eventPanelX = Math.max(250, Math.min(this.cameras.main.width - 550, this.cameras.main.width * 0.38));
        this.eventsPanel = this.add.container(eventPanelX, 110);
        this.eventsPanel.setScrollFactor(0);
        this.eventsPanel.setDepth(2800);
        this.eventsPanel.setVisible(false);

        const bg = this.add.rectangle(0, 0, 520, 300, 0x0f172a, 0.98).setOrigin(0, 0);
        bg.setDepth(1);
        bg.setInteractive();
        bg.on('pointerdown', pointer => pointer?.event?.stopPropagation());
        const title = this.add.text(18, 14, '⚠️ Climate Events', { fontSize: '18px', color: '#fcd34d', fontStyle: 'bold' });
        const close = this.add.text(490, 14, '✕', { fontSize: '16px', color: '#f43f5e', backgroundColor: '#1e293b', padding: { x: 5, y: 2 } }).setOrigin(1, 0);
        close.setDepth(20);
        close.setInteractive({ useHandCursor: true });
        close.on('pointerdown', pointer => { pointer?.event?.stopPropagation(); this.toggleClimateEvents(false); });

        this.eventText = this.add.text(18, 52, '', {
            fontSize: '14px', color: '#f1f5f9', wordWrap: { width: 470 }, lineSpacing: 7
        });
        this.eventAction = this.add.text(18, 248, 'Prepare in 2016', {
            fontSize: '13px', color: '#0f172a', backgroundColor: '#38bdf8', padding: { x: 9, y: 6 }
        });
        this.eventAction.setDepth(20);
        this.eventAction.setInteractive({ useHandCursor: true });
        this.eventAction.on('pointerdown', pointer => { pointer?.event?.stopPropagation(); this.prepareActiveClimateEvent(); });
        this.eventsPanel.add([bg, title, close, this.eventText, this.eventAction]);
        this.repositionClimateEventsPanel = () => {
            const width = this.cameras.main.width;
            this.eventsPanel.x = Math.max(250, Math.min(width - 550, width * 0.38));
        };
        this.scale.on('resize', this.repositionClimateEventsPanel);
    }

    toggleClimateEvents(forceState) {
        this.eventsPanelVisible = forceState !== undefined ? !!forceState : !this.eventsPanelVisible;
        this.eventsPanel.setVisible(this.eventsPanelVisible);
        this.eventsPanel.setActive(this.eventsPanelVisible);
        if (this.eventsPanelVisible) {
            this.repositionClimateEventsPanel?.();
            this.refreshClimateEventsPanel();
            this.maybeAnnounceActiveClimateEvent();
        }
    }

    maybeAnnounceActiveClimateEvent() {
        const events = this.gameData.climateEvents;
        const active = events.active;
        if (!active || !events[active] || events[active].announced) return;
        events[active].announced = true;
        const messages = {
            heatwave: 'A heatwave has begun in 2026. Elif and Meryem are most vulnerable in areas without shade.',
            waterCrisis: 'A water crisis has begun. Zeynep’s neighborhood needs rainwater collection and conservation.',
            flashFlood: 'A flash flood warning is active. Hasan’s neighborhood needs better drainage.'
        };
        this.showInfoPanel('Climate Event Begins', messages[active], 'info');
        this.notify(messages[active], 'warning', 3600);
    }

    advanceClimateEvent() {
        const events = this.gameData.climateEvents;
        const order = ['heatwave', 'waterCrisis', 'flashFlood'];
        const currentIndex = Math.max(0, order.indexOf(events.active));
        const next = order[currentIndex + 1];
        if (!next) return;
        events.active = next;
        events[next].status = 'pending';
        events[next].announced = false;
        this.refreshClimateEventsPanel();
        this.maybeAnnounceActiveClimateEvent();
    }

    refreshClimateEventsPanel() {
        const events = this.gameData.climateEvents;
        const active = events.active || (this.gameData.is2016 ? 'heatwave' : 'heatwave');
        events.active = active;
        const details = {
            heatwave: {
                title: 'Heatwave — Elif and Meryem are vulnerable',
                body: 'The 2026 heatwave is strongest in neighborhoods without shade. Travel to 2016 and plant trees or add shade infrastructure before returning.',
                mission: 'elifHelp'
            },
            waterCrisis: {
                title: 'Water Crisis — Zeynep needs preparation',
                body: 'Dry conditions are reducing water availability. Rainwater collection, water-saving systems and drought-resistant greens reduce the impact.',
                mission: 'zeynepHelp'
            },
            flashFlood: {
                title: 'Flash Flood — Hasan needs protection',
                body: 'Heavy rainfall threatens low-drainage streets. Rain gardens, permeable pavement and collectors reduce local flood risk.',
                mission: 'hasanHelp'
            }
        }[active];
        const event = events[active];
        const status = event.prepared
            ? '✅ Prepared: local impacts are reduced in 2026.'
            : (this.gameData.is2016
                ? '🛠️ Next step: build the listed improvements in this neighborhood, then check preparation.'
                : '⏳ Next step: travel to 2016, build the listed improvements, then return to 2026.');
        const guidance = this.getMissionGuidance(details.mission);
        const nextStep = guidance.length ? `\n\nWhat to build:\n${guidance.map(step => `• ${step}`).join('\n')}` : '';
        this.eventText.setText(`🌡️ ${details.title}\n\n${details.body}${nextStep}\n\n${status}`);
        this.eventAction.setText(this.gameData.is2016 ? (event.prepared ? 'Next event' : 'Check preparation') : 'Travel to 2016');
        this.eventAction.setVisible(!event.prepared || this.gameData.is2016);
        this.eventAction.removeAllListeners('pointerdown');
        this.eventAction.on('pointerdown', pointer => {
            pointer?.event?.stopPropagation();
            if (event.prepared && this.gameData.is2016) this.advanceClimateEvent();
            else this.prepareActiveClimateEvent();
        });
    }

    prepareActiveClimateEvent() {
        const events = this.gameData.climateEvents;
        const active = events.active;
        const missionByEvent = { heatwave: 'elifHelp', waterCrisis: 'zeynepHelp', flashFlood: 'hasanHelp' };
        if (!this.gameData.is2016) {
            this.showInfoPanel('Travel Required', 'Return to 2016 to prepare this climate event.', 'info');
            return;
        }
        const progress = this.buildMissionProgress(missionByEvent[active]);
        if (progress.length && progress.every(item => item.done)) {
            events[active].prepared = true;
            events[active].status = 'prepared';
            events.lastResolved = active;
            this.showInfoPanel('Climate Event Prepared', 'The relevant neighborhood is better protected in 2026.', 'info');
            this.refreshClimateEventsPanel();
        } else {
            const eventGuidance = {
                heatwave: 'In 2016, plant a sapling near the school route and place a Shade Awning there. Return to this panel when both improvements are built.',
                waterCrisis: 'In 2016, place a Rainwater Collector, Water-Saving Infrastructure, and Drought-Resistant Greens near Zeynep\'s neighborhood. Then check this event again.',
                flashFlood: 'In 2016, place a Cooling Fountain, Permeable Pavement, and Rainwater Collector near Hasan\'s shop. Then check this event again.'
            }[active] || 'Travel to 2016 and build the listed improvements before checking this event again.';
            this.showInfoPanel('Preparation Incomplete', eventGuidance, 'info');
        }
    }

    toggleHeatMap(forceState) {
        this.heatMapVisible = forceState !== undefined ? !!forceState : !this.heatMapVisible;
        if (this.heatMapOverlay) this.heatMapOverlay.setActive(this.heatMapVisible);
        if (this.heatMapVisible) {
            if (!this.heatMapOverlay) {
                this.heatMapOverlay = this.add.container(0, 0);
                // The overlay belongs to the world, so it pans with the map.
                this.heatMapOverlay.setDepth(50);
                this.heatMapOverlay.setScrollFactor(1);
                this.heatMapOverlay.setVisible(false);
                this.heatMapOverlay.setActive(false);
            }
            this.heatMapOverlay.setVisible(true);
            this.updateHeatMap();
        } else if (this.heatMapOverlay) {
            this.heatMapOverlay.setVisible(false);
            this.heatMapOverlay.setActive(false);
        }
        if (this.heatMapButton) {
            this.heatMapButton.setText(`Heat Map: ${this.heatMapVisible ? 'On' : 'Off'}`);
            this.heatMapButton.setStyle({
                backgroundColor: this.heatMapVisible ? '#22c55e' : '#64748b'
            });
        }
        if (this.heatMapLegend) {
            this.heatMapLegend.setVisible(this.heatMapVisible);
        }
    }

    updateHeatMap() {
        if (!this.heatMapVisible || !this.heatMapOverlay || !this.climateState) return;
        this.heatMapOverlay.removeAll(true);

        const areas = [
            // Each zone maps directly to the same six areas used by climateState.localHeat.
            { x: 500, y: 420, w: 440, h: 300 }, { x: 1060, y: 420, w: 440, h: 300 },
            { x: 1620, y: 420, w: 440, h: 300 }, { x: 500, y: 820, w: 440, h: 300 },
            { x: 1060, y: 820, w: 440, h: 300 }, { x: 1620, y: 820, w: 440, h: 300 }
        ];
        const scores = this.climateState.localHeat || [];
        areas.forEach((area, index) => {
            const score = scores[index] || 0;
            const color = score > 75 ? 0xef4444 : score > 50 ? 0xf59e0b : score > 25 ? 0xfacc15 : 0x22c55e;
            const zone = this.add.rectangle(area.x, area.y, area.w, area.h, color, 0.22);
            zone.setDepth(0);
            zone.setStrokeStyle(2, color, 0.55);
            this.heatMapOverlay.add(zone);
            const label = this.add.text(area.x, area.y, `Heat risk ${score}/100`, {
                fontSize: '13px', fontFamily: 'Arial', color: '#ffffff',
                backgroundColor: '#0f172a', padding: { x: 5, y: 3 }
            }).setOrigin(0.5).setAlpha(0.9);
            label.setDepth(1);
            this.heatMapOverlay.add(label);
        });
    }

    toggleClimateDashboard(forceState) {
        const next = (forceState !== undefined) ? !!forceState : !this.climateDashboardVisible;
        this.climateDashboardVisible = next;
        if (this.climatePanel) {
            this.climatePanel.setVisible(next);
            this.climatePanel.setActive(next);
        }
        if (!next) {
            this.toggleHeatMap(false);
            return;
        }
        this.refreshClimateDashboard();
    }

    refreshClimateDashboardIfVisible() {
        if (this.climateDashboardVisible && this.climatePanel && this.climatePanel.visible) {
            this.refreshClimateDashboard();
        }
    }

    refreshClimateDashboard() {
        if (!this.climateIndicatorRows) return;

        // Phase 4 climate model: fictional simulation scores, connected to the shared placement state.
        const placed = this.placedItems || [];
        const countType = (type) => placed.filter(p => p.type === type).length;
        const near = (x, y, radius) => placed.filter(p => Math.hypot(p.x - x, p.y - y) <= radius);
        const countNear = (types, x, y, radius) => near(x, y, radius).filter(p => types.includes(p.type)).length;
        const clamp = (value) => Phaser.Math.Clamp(Math.round(value), 0, 100);

        const rainGardens = this.gameData.futureState.rainGardens || 0;
        const permeablePavements = this.gameData.futureState.permeablePavements || 0;
        const rainCollectors = this.gameData.futureState.rainCollectors || 0;
        const waterSaving = this.gameData.futureState.waterSaving || 0;
        const droughtGreens = this.gameData.futureState.droughtGreens || 0;
        const matureTrees = this.gameData.futureState.matureTrees || 0;
        const busStops = this.gameData.futureState.busStops || 0;
        const bikeLanes = countType('bikeLane');
        const solarRoofs = countType('solarRoof');
        const greenRoofs = countType('greenRoof');
        const shadeAwnings = countType('shadeAwning');
        const completedMissions = Object.values(this.gameData.missions || {}).filter(Boolean).length;

        // Local heat exposure is sampled at six recognizable neighborhoods, then averaged.
        // Infrastructure only cools the area around its actual map location.
        const neighborhoods = [
            { x: 500, y: 420, base: 72 }, { x: 1060, y: 420, base: 42 },
            { x: 1620, y: 420, base: 64 }, { x: 500, y: 820, base: 78 },
            { x: 1060, y: 820, base: 58 }, { x: 1620, y: 820, base: 70 }
        ];
        const localHeat = neighborhoods.map(area => {
            const local = near(area.x, area.y, 360);
            const cooling = local.reduce((sum, item) => {
                const effects = { sapling: 9, shadeAwning: 8, greenRoof: 10, fountain: 11, solarRoof: 3, busStop: 2 };
                return sum + (effects[item.type] || 0);
            }, 0);
            return clamp(area.base - cooling);
        });
        const urbanHeat = clamp(localHeat.reduce((sum, score) => sum + score, 0) / localHeat.length + (this.gameData.is2016 ? 0 : 8));

        const waterSecurity = clamp(15 + rainGardens * 10 + permeablePavements * 12 + rainCollectors * 18 + waterSaving * 14 + droughtGreens * 8);
        const cleanEnergy = clamp(10 + solarRoofs * 22 + greenRoofs * 8 + bikeLanes * 3 + (busStops > 0 ? 8 : 0));
        const carbonFootprint = clamp(100 - (matureTrees * 5 + busStops * 4 + bikeLanes * 6 + solarRoofs * 14 + greenRoofs * 6));

        // Equity rewards coverage across distinct neighborhoods, not only total construction.
        const coveredAreas = neighborhoods.filter(area => near(area.x, area.y, 360).length > 0).length;
        const climateEquity = clamp(12 + coveredAreas * 10 + completedMissions * 5);
        const temperature = this.gameData.temperature ?? 34;
        const wellbeing = clamp(100 - Math.max(0, temperature - 26) * 6 - urbanHeat * 0.18 + completedMissions * 4);

        this.climateState = {
            urbanHeat, localHeat, waterSecurity, cleanEnergy, carbonFootprint,
            climateEquity, wellbeing, updatedAt: Date.now()
        };
        const currentEraKey = this.gameData.is2016 ? 'past' : 'future';
        if (!this.climateBaseline[currentEraKey]) {
            this.climateBaseline[currentEraKey] = { ...this.climateState };
        }
        if (this.heatMapVisible) this.updateHeatMap();
        const computed = this.climateState;
        const eraKey = this.gameData.is2016 ? 'past' : 'future';
        this.climateHistory[eraKey] = { ...computed };

        if (this.climateCompareText) {
            const past = this.climateHistory.past;
            const future = this.climateHistory.future;
            if (past && future) {
                this.climateCompareText.setText(`2016 → 2026  Heat ${past.urbanHeat} → ${future.urbanHeat}  |  Water ${past.waterSecurity} → ${future.waterSecurity}`);
            } else {
                this.climateCompareText.setText('Travel between eras to compare climate simulation values.');
            }
            this.climateCompareText.setVisible(!!past && !!future);
        }

        if (this.climateEraText) {
            const eraLabel = this.gameData?.is2016 ? '2016 planning → 2026 readiness' : '2026 present climate assessment';
            this.climateEraText.setText(eraLabel);
        }

        const scoreToStatus = (id, score) => {
            if (id === 'carbonFootprint') {
                if (score <= 25) return 'Excellent — low emissions.';
                if (score <= 50) return 'Good — emissions are controlled.';
                if (score <= 75) return 'High — reduce carbon with solar/trees/bikes.';
                return 'Critical — emissions are too high.';
            }
            if (id === 'urbanHeat') {
                if (score <= 25) return 'Low risk — cool local conditions.';
                if (score <= 50) return 'Moderate risk — add shade and greenery.';
                if (score <= 75) return 'High risk — heat exposure is increasing.';
                return 'Critical — vulnerable areas need cooling.';
            }

            if (score <= 25) return 'Very low — add more infrastructure.';
            if (score <= 50) return 'Some progress — keep building.';
            if (score <= 75) return 'Strong — systems are working.';
            return 'Excellent — near-resilient city conditions.';
        };

        const scoreToColor = (id, score) => {
            // High-wrong indicators use red when high.
            if (id === 'carbonFootprint' || id === 'urbanHeat') {
                if (score <= 25) return 0x22c55e; // green
                if (score <= 50) return 0xfacc15; // yellow
                if (score <= 75) return 0xf59e0b; // orange
                return 0xf43f5e; // red
            }

            // High-is-good uses red when low.
            if (score <= 25) return 0xef4444;
            if (score <= 50) return 0xf59e0b;
            if (score <= 75) return 0xfacc15;
            return 0x22c55e;
        };

        Object.entries(this.climateIndicatorRows).forEach(([id, row]) => {
            const score = Math.round(computed[id] || 0);
            row.scoreText.setText(`${score}/100`);

            const barWidth = row.barBg.width;
            const fillW = (barWidth * score) / 100;
            row.fill.width = fillW;
            row.fill.setFillStyle(scoreToColor(id, score));

            const baseline = this.climateBaseline[this.gameData.is2016 ? 'past' : 'future'];
            const baselineScore = baseline ? Math.round(baseline[id] || 0) : score;
            const delta = score - baselineScore;
            const direction = delta === 0 ? '• baseline' : (delta > 0 ? `↑ ${delta} since first visit` : `↓ ${Math.abs(delta)} since first visit`);
            row.status.setText(`${scoreToStatus(id, score)}  ${direction}`);

            // Extra carbon direction hint in the status
            if (id === 'carbonFootprint') {
                // Keep the carbon direction explicit because lower is better.
                row.status.setText(`${scoreToStatus(id, score)}  ${direction}`);
            }
        });
    }

    createActionButton(x, y, label, bgColor, callback) {
        const btn = this.add.text(x, y, label, {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#0f172a',
            backgroundColor: bgColor,
            padding: { x: 7, y: 5 }
        });
        btn.setScrollFactor(0);
        btn.ignoreCull = true;
        btn.setDepth(10004);
        btn.setInteractive({ useHandCursor: true });
        btn.setVisible(false);
        btn.on('pointerdown', pointer => {
            pointer?.event?.stopPropagation();
            callback();
        });
        return btn;
    }

    closeMapOverlayPanels() {
        if (this.climateDashboardVisible) this.toggleClimateDashboard(false);
        if (this.eventsPanelVisible) this.toggleClimateEvents(false);
        if (this.heatMapVisible) this.toggleHeatMap(false);
    }

    showLocationInfo(location) {
        this.closeMapOverlayPanels();
        const info = location.getInfo();
        this.showInfoPanel(info.name, info.description, 'info');
    }

    clearInfoPanelContent() {
        if (this.infoTitle) this.infoTitle.setText('');
        if (this.infoBody) this.infoBody.setText('');
        this.resetInfoScroll();
    }

    getClimateMemoryDialogue(character, story, missionKey, progressLines) {
        const completed = !!this.gameData.missions[missionKey];
        const progressCount = progressLines.filter(item => item.done).length;
        const hasProgress = progressCount > 0;
        const event = this.gameData.climateEvents || {};
        const preparedEvent = Object.keys(event).find(key => event[key]?.prepared);

        if (completed) return story.outcome || 'Thank you. Things are much better now.';
        if (this.gameData.is2016) {
            if (hasProgress) return `You have already started helping. ${progressCount} objective${progressCount === 1 ? '' : 's'} complete — keep building the remaining infrastructure.`;
            return 'Travel back to 2016 — your actions here will shape my future. Help me by completing the objectives below.';
        }

        const improvedDialogue = {
            meryem: 'The new route is helping me, but I still need the remaining improvements before I can travel independently.',
            elif: 'The school route is starting to change, but hot days are still difficult until every objective is complete.',
            deniz: 'I can see the city beginning to support cycling, but the network is not complete yet.',
            ayse: 'There is a little more relief in the neighborhood, but we still need more shade and greenery.',
            hasan: 'Some protection is in place, but heavy rain can still threaten the shop until drainage is complete.',
            zeynep: 'The neighborhood has begun preparing for dry periods, but our water security is not complete yet.'
        };
        if (hasProgress) return improvedDialogue[character.type] || 'I can see the improvements, but my problem is not solved yet.';
        if (preparedEvent) return `The ${preparedEvent} preparations are helping the city, but my own objectives still need attention.`;
        return story.problem2026 || 'I still need help.';
    }

    showCharacterInfo(character) {
        this.closeMapOverlayPanels();
        const info = character.getInfo();
        const story = info.story || {};
        const missionKey = story.missionKey || character.type + 'Help';
        const isCompleted = this.gameData.missions[missionKey];
        const is2016 = this.gameData.is2016;

        // Build objective progress based on actual placed infrastructure
        const progressLines = this.buildMissionProgress(missionKey);

        // Dialogue is derived from persistent mission progress and era state.
        const dialogue = this.getClimateMemoryDialogue(character, story, missionKey, progressLines);

        const statusLabel = isCompleted ? '✅ Completed' : (progressLines.some(item => item.done) ? '🔧 In Progress' : (is2016 ? '🛠️ Planning in 2016' : '⚠️ Available'));

        // Compose well-formatted 9-element panel text
        const lines = [];
        lines.push(`👤 ${info.name}`);
        lines.push('');
        lines.push(`📖 Intro: ${story.intro || info.description || ''}`);
        lines.push('');
        lines.push(`📝 Story: ${story.story || ''}`);
        lines.push('');
        if (!is2016 || isCompleted) {
            lines.push(`⚠️ 2026 Problem: ${story.problem2026 || ''}`);
            lines.push('');
            lines.push(`🔎 Cause: ${story.cause || ''}`);
            lines.push('');
        }
        lines.push(`🎯 Objectives:`);
        (story.objectives || []).forEach((obj, i) => {
            const done = progressLines[i] && progressLines[i].done;
            const mark = done ? '✅' : '⬜';
            lines.push(`   ${mark} ${obj}`);
        });
        lines.push('');
        lines.push(`🌟 Expected Outcome: ${story.outcome || ''}`);
        lines.push('');
        lines.push(`💬 "${dialogue}"`);
        lines.push('');
        lines.push(`Status: ${statusLabel}`);

        const guidance = this.getMissionGuidance(missionKey);
        lines.push('');
        lines.push('➡️ Next step:');
        if (isCompleted) {
            lines.push('   Return to 2026 to see how these improvements changed the resident\'s daily life.');
        } else if (!is2016) {
            lines.push('   Travel to 2016, build the unchecked improvements below, then return to 2026.');
        } else {
            lines.push(...guidance.map((step, index) => {
                const done = progressLines[index] && progressLines[index].done;
                return `   ${done ? '✅' : '•'} ${step}`;
            }));
        }

        const panelText = lines.join('\n');

        // Mission action button: only allow completion in 2026 if objectives are satisfied,
        // or auto-complete when player is in 2016 and has built the required infrastructure.
        this.actionBtnMission.removeAllListeners('pointerdown');
        this.actionBtnMission.setText(isCompleted ? '✅ Mission Complete' : '🤝 Check Mission');
        this.actionBtnMission.on('pointerdown', () => this.completeMission(missionKey));
        this.actionBtnMission.setVisible(true);

        this.showInfoPanel(info.name, panelText, 'mission');
    }

    // Build per-objective progress based on actual placed infrastructure in shared game state.
    buildMissionProgress(missionKey) {
        const placed = this.placedItems || [];
        const progress = [];

        const countType = (type) => placed.filter(p => p.type === type).length;

        switch (missionKey) {
            case 'meryemHelp': {
                // Objective 1: bus stop near her home (x:440, y:380). Allow within ~400px.
                const hasNearBusStop = placed.some(p =>
                    p.type === 'busStop' &&
                    Math.abs(p.x - 440) < 400 && Math.abs(p.y - 380) < 400
                );
                // Objective 2: shade trees along walking route (saplings planted).
                const hasShade = countType('sapling') >= 2;
                progress.push({ done: hasNearBusStop });
                progress.push({ done: hasShade });
                break;
            }
            case 'elifHelp': {
                // Trees + shade awnings near the school (x:1620, y:420).
                const nearSchool = placed.filter(p =>
                    Math.abs(p.x - 1620) < 400 && Math.abs(p.y - 420) < 400
                );
                progress.push({ done: nearSchool.some(p => p.type === 'sapling') });
                progress.push({ done: nearSchool.some(p => p.type === 'shadeAwning') });
                break;
            }
            case 'denizHelp': {
                progress.push({ done: countType('bikeLane') >= 2 });
                progress.push({ done: countType('bikeLane') >= 4 });
                break;
            }
            case 'ayseHelp': {
                progress.push({ done: countType('sapling') >= 3 });
                progress.push({ done: countType('greenRoof') >= 1 });
                progress.push({ done: countType('shadeAwning') >= 1 || countType('sapling') >= 5 });
                break;
            }
            case 'hasanHelp': {
                const nearShop = placed.filter(p =>
                    Math.abs(p.x - 500) < 400 && Math.abs(p.y - 820) < 400
                );

                // Objective 1: rain gardens (use fountain as a rain-absorbing green element)
                progress.push({ done: nearShop.some(p => p.type === 'fountain') });

                // Objective 2: permeable pavement
                progress.push({ done: nearShop.some(p => p.type === 'permeablePavement') });

                // Objective 3: rainwater collection infrastructure
                progress.push({ done: nearShop.some(p => p.type === 'rainCollector') });

                break;
            }
            case 'zeynepHelp': {
                const nearZeynep = placed.filter(p =>
                    Math.abs(p.x - 500) < 400 && Math.abs(p.y - 1220) < 400
                );

                // Objective 1: rainwater harvesting systems
                progress.push({ done: nearZeynep.some(p => p.type === 'rainCollector') });

                // Objective 2: water-saving infrastructure
                progress.push({ done: nearZeynep.some(p => p.type === 'waterSaving') });

                // Objective 3: drought-resistant green spaces
                progress.push({ done: nearZeynep.some(p => p.type === 'droughtGreen') });

                break;
            }
            default:
                break;
        }
        return progress;
    }

    resetInfoScroll() {
        this.infoScrollOffset = 0;
        if (this.infoBody) this.infoBody.y = 0;
    }

    refreshInfoScroll() {
        if (!this.infoBody) return;

        const totalHeight = this.infoBody.height || 0;
        const visibleHeight = this.infoMaskHeight || 120;
        this.infoScrollMax = Math.max(0, totalHeight - visibleHeight);

        // Clamp current offset after text reflow
        this.infoScrollOffset = Phaser.Math.Clamp(this.infoScrollOffset, 0, this.infoScrollMax);
        this.infoBody.y = -this.infoScrollOffset;

        const hasScroll = this.infoScrollMax > 1;
        if (this.infoScrollUpBtn) this.infoScrollUpBtn.setVisible(hasScroll && this.infoScrollOffset > 0);
        if (this.infoScrollDownBtn) this.infoScrollDownBtn.setVisible(hasScroll && this.infoScrollOffset < this.infoScrollMax);
    }

    scrollInfo(deltaY) {
        if (this.infoScrollMax <= 0) return;

        this.infoScrollOffset = Phaser.Math.Clamp(this.infoScrollOffset + deltaY, 0, this.infoScrollMax);
        this.infoBody.y = -this.infoScrollOffset;

        if (this.infoScrollUpBtn) this.infoScrollUpBtn.setVisible(this.infoScrollOffset > 0);
        if (this.infoScrollDownBtn) this.infoScrollDownBtn.setVisible(this.infoScrollOffset < this.infoScrollMax);
    }

    showInfoPanel(title, text, mode = 'info') {
        this.infoPanelBg.setVisible(true);
        this.infoPanelBorder.setVisible(true);
        this.infoTitle.setVisible(true);
        this.infoBody.setVisible(true);
        this.closeBtn.setVisible(true);

        this.infoTitle.setText(String(title || ''));
        this.infoTitle.setFontSize(mode === 'mission' ? '18px' : '19px');

        // Reset and refresh scroll viewport before/after text is set
        this.resetInfoScroll();
        this.infoBody.setText(String(text || ''));
        this.infoBody.setLineSpacing(mode === 'mission' ? 5 : 4);
        this.refreshInfoScroll();

        [this.actionBtn1, this.actionBtn2, this.actionBtnMission].forEach(b => b.setVisible(false));

        if (mode === 'timeMachine') {
            this.actionBtn1.setVisible(true);
            this.actionBtn2.setVisible(true);
        } else if (mode === 'mission') {
            this.actionBtnMission.setVisible(true);
        }
    }

    hideInfoPanel() {
        this.infoPanelBg.setVisible(false);
        this.infoPanelBorder.setVisible(false);
        this.infoTitle.setVisible(false);
        this.infoBody.setVisible(false);
        this.closeBtn.setVisible(false);
        [this.actionBtn1, this.actionBtn2, this.actionBtnMission].forEach(b => b.setVisible(false));

        if (this.infoScrollUpBtn) this.infoScrollUpBtn.setVisible(false);
        if (this.infoScrollDownBtn) this.infoScrollDownBtn.setVisible(false);

        this.deselectAll();
    }

    deselectAll() {
        if (this.selectedLocation) {
            this.selectedLocation.deselect();
            this.selectedLocation = null;
        }
        if (this.selectedCharacter) {
            this.selectedCharacter.deselect();
            this.selectedCharacter = null;
        }
    }

    update(time, delta) {
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            if (this.placementMode && this.placementMode.active) {
                this.cancelPlacementMode();
            } else if (this.urbanPlanningPanelVisible) {
                this.toggleUrbanPlanningPanel(false);
            } else {
                this.hideInfoPanel();
            }
        }

        if (this.placementMode && this.placementMode.active) {
            this.updatePlacementGhost(this.input.activePointer);
        }

        const cam = this.cameras.main;
        const camSpeed = 10 * this.gameData.speed;
        if (this.cursors.left.isDown || this.wasd.left.isDown) cam.scrollX -= camSpeed;
        if (this.cursors.right.isDown || this.wasd.right.isDown) cam.scrollX += camSpeed;
        if (this.cursors.up.isDown || this.wasd.up.isDown) cam.scrollY -= camSpeed;
        if (this.cursors.down.isDown || this.wasd.down.isDown) cam.scrollY += camSpeed;

        const realSecondsPassed = (delta / 1000) * this.gameData.speed;
        this.timeAccumulator += realSecondsPassed;
        this.autosaveAccumulator += delta;
        if (this.autosaveAccumulator >= 15000) {
            this.autosaveAccumulator = 0;
            this.saveGame();
        }

        if (this.timeAccumulator >= 1.0) {
            const minutesPassed = Math.floor(this.timeAccumulator);
            this.timeAccumulator -= minutesPassed;

            this.gameData.minute += minutesPassed;

            if (this.gameData.minute >= 60) {
                const hoursPassed = Math.floor(this.gameData.minute / 60);
                this.gameData.minute %= 60;
                this.gameData.hour += hoursPassed;

                if (this.gameData.hour >= 24) {
                    this.gameData.hour %= 24;
                    this.gameData.day += 1;
                }
            }

            this.hud.updateClock(this.gameData.day, this.gameData.hour, this.gameData.minute);
        }

        // 1. Two-way traffic right-hand movement & smooth intersection turning
        if (this.cars) {
            this.cars.forEach(car => {
                // Safe following distance (anti-bunching)
                let isBlocked = false;
                for (let other of this.cars) {
                    if (other === car) continue;
                    if (other.axis === car.axis && other.dir === car.dir) {
                        if (car.axis === 'h' && Math.abs(other.sprite.y - car.sprite.y) < 10) {
                            const dist = (other.sprite.x - car.sprite.x) * car.dir;
                            if (dist > 0 && dist < 42) {
                                isBlocked = true;
                                break;
                            }
                        } else if (car.axis === 'v' && Math.abs(other.sprite.x - car.sprite.x) < 10) {
                            const dist = (other.sprite.y - car.sprite.y) * car.dir;
                            if (dist > 0 && dist < 42) {
                                isBlocked = true;
                                break;
                            }
                        }
                    }
                }

                // Also check if transit bus is ahead in the same lane
                if (this.transitBus && this.transitBus.sprite) {
                    const bus = this.transitBus;
                    if (bus.axis === car.axis && bus.dir === car.dir) {
                        if (car.axis === 'h' && Math.abs(bus.sprite.y - car.sprite.y) < 14) {
                            const dist = (bus.sprite.x - car.sprite.x) * car.dir;
                            if (dist > 0 && dist < 58) {
                                isBlocked = true;
                            }
                        } else if (car.axis === 'v' && Math.abs(bus.sprite.x - car.sprite.x) < 14) {
                            const dist = (bus.sprite.y - car.sprite.y) * car.dir;
                            if (dist > 0 && dist < 58) {
                                isBlocked = true;
                            }
                        }
                    }
                }

                const actualSpeed = isBlocked ? (car.speed * 0.25) : car.speed;
                car.sprite.x += (car.vx / car.speed) * actualSpeed * this.gameData.speed;
                car.sprite.y += (car.vy / car.speed) * actualSpeed * this.gameData.speed;

                // Intersection turning logic preserving correct right-hand lanes
                this.roadX.forEach(rx => {
                    this.roadY.forEach(ry => {
                        // Check if car reaches intersection center
                        if (car.axis === 'h') {
                            if (Math.abs(car.sprite.x - rx) < 3 && Math.random() < 0.08) {
                                // Turn to vertical road
                                car.axis = 'v';
                                car.roadX = rx;
                                car.dir = Phaser.Math.RND.pick([1, -1]);
                                car.vx = 0;
                                car.vy = car.dir * car.speed;
                                // Align to right lane of vertical road: dir=1 (South) -> X - 20, dir=-1 (North) -> X + 20
                                car.sprite.x = rx + (car.dir === 1 ? -20 : 20);
                                car.sprite.setAngle(car.dir === 1 ? 90 : 270);
                            }
                        } else {
                            if (Math.abs(car.sprite.y - ry) < 3 && Math.random() < 0.08) {
                                // Turn to horizontal road
                                car.axis = 'h';
                                car.roadY = ry;
                                car.dir = Phaser.Math.RND.pick([1, -1]);
                                car.vy = 0;
                                car.vx = car.dir * car.speed;
                                // Align to right lane of horizontal road: dir=1 (East) -> Y + 20, dir=-1 (West) -> Y - 20
                                car.sprite.y = ry + (car.dir === 1 ? 20 : -20);
                                car.sprite.setAngle(car.dir === 1 ? 0 : 180);
                            }
                        }
                    });
                });

                // Wrap around map bounds
                if (car.sprite.x > 2520) car.sprite.x = 40;
                else if (car.sprite.x < 40) car.sprite.x = 2520;
                if (car.sprite.y > 1420) car.sprite.y = 40;
                else if (car.sprite.y < 40) car.sprite.y = 1420;
            });
        }

        // Sidewalk Pedestrian Movement
        if (this.pedestrians) {
            this.pedestrians.forEach(ped => {
                ped.sprite.x += ped.vx * this.gameData.speed;
                ped.sprite.y += ped.vy * this.gameData.speed;

                // Turn corners at crosswalk intersections
                this.roadX.forEach(rx => {
                    this.roadY.forEach(ry => {
                        const targetX = rx + ped.sideOffset;
                        const targetY = ry + ped.sideOffset;
                        if (Math.abs(ped.sprite.x - targetX) < 4 && Math.abs(ped.sprite.y - targetY) < 4 && Math.random() < 0.05) {
                            if (ped.axis === 'h') {
                                ped.axis = 'v';
                                ped.vx = 0;
                                ped.vy = Phaser.Math.RND.pick([-1, 1]) * ped.speed;
                            } else {
                                ped.axis = 'h';
                                ped.vy = 0;
                                ped.vx = Phaser.Math.RND.pick([-1, 1]) * ped.speed;
                            }
                        }
                    });
                });

                // Wrap around
                if (ped.sprite.x > 2500) ped.sprite.x = 50;
                else if (ped.sprite.x < 50) ped.sprite.x = 2500;
                if (ped.sprite.y > 1400) ped.sprite.y = 50;
                else if (ped.sprite.y < 50) ped.sprite.y = 1400;
            });
        }

        // 3. Update Working Public Transit Bus
        this.updateTransitBus(delta);

        // Keep the HUD temperature connected to the same infrastructure state as the dashboard.
        const coolingCounts = (this.placedItems || []).reduce((counts, item) => {
            counts[item.type] = (counts[item.type] || 0) + 1;
            return counts;
        }, {});
        let baseTemp = this.gameData.is2016 ? 34 : 42;
        baseTemp -= (this.gameData.futureState.matureTrees || 0) * 0.5;
        baseTemp -= (coolingCounts.shadeAwning || 0) * 0.25;
        baseTemp -= (coolingCounts.greenRoof || 0) * 0.35;
        baseTemp -= (coolingCounts.fountain || 0) * 0.35;
        baseTemp -= (coolingCounts.sapling || 0) * (this.gameData.is2016 ? 0.1 : 0.5);

        if (this.gameData.hour >= 12 && this.gameData.hour <= 17) {
            baseTemp += 4;
        } else if (this.gameData.hour < 6 || this.gameData.hour > 21) {
            baseTemp -= 5;
        }
        this.gameData.temperature = baseTemp;
        this.hud.updateTemperature(baseTemp, this.gameData.is2016);

        // Keep wellbeing indicator responsive while the dashboard is open.
        if (this.eventsPanelVisible && time >= (this.climateEventsNextRefreshAt || 0)) {
            this.refreshClimateEventsPanel();
            this.climateEventsNextRefreshAt = time + 800;
        }

        if (this.climateDashboardVisible && this.climatePanel && this.climatePanel.visible) {
            if (time >= this.climateDashboardNextRefreshAt) {
                this.refreshClimateDashboard();
                this.climateDashboardNextRefreshAt = time + 800;
            }
        }
    }

    updateTransitBus(delta) {
        if (!this.transitBus || !this.transitBus.sprite) return;
        const bus = this.transitBus;
        const speed = bus.speed * this.gameData.speed;

        // If currently stopped at a bus stop
        if (bus.state === 'boarding') {
            bus.stopTimer -= (delta / 1000) * this.gameData.speed;
            if (bus.stopTimer <= 0) {
                bus.state = 'driving';
                bus.statusText.setText('🚌 Line 42: En Route');
                bus.statusText.setColor('#38bdf8');
            }
            return;
        }

        // Drive towards next waypoint along the transit route
        const target = this.busRoute[bus.nextWaypointIndex];
        const dx = target.x - bus.sprite.x;
        const dy = target.y - bus.sprite.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= (speed * 1.5)) {
            // Reached target waypoint
            bus.sprite.x = target.x;
            bus.sprite.y = target.y;
            bus.currentWaypointIndex = bus.nextWaypointIndex;
            bus.nextWaypointIndex = (bus.nextWaypointIndex + 1) % this.busRoute.length;

            // Check if this waypoint is a designated bus stop
            if (target.stopId) {
                this.handleBusArrivalAtStop(bus, target);
            } else {
                // Adjust heading angle for new segment
                const nextTarget = this.busRoute[bus.nextWaypointIndex];
                const angle = Phaser.Math.RadToDeg(Math.atan2(nextTarget.y - bus.sprite.y, nextTarget.x - bus.sprite.x));
                bus.sprite.setAngle(angle);
                bus.axis = Math.abs(nextTarget.x - bus.sprite.x) > Math.abs(nextTarget.y - bus.sprite.y) ? 'h' : 'v';
                bus.dir = (bus.axis === 'h') ? (nextTarget.x >= bus.sprite.x ? 1 : -1) : (nextTarget.y >= bus.sprite.y ? 1 : -1);
            }
        } else {
            // Move bus forward
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;
            bus.sprite.x += vx;
            bus.sprite.y += vy;

            // Update angle to face heading
            const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
            bus.sprite.setAngle(angle);
            bus.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
            bus.dir = (bus.axis === 'h') ? (dx >= 0 ? 1 : -1) : (dy >= 0 ? 1 : -1);
        }

        // Keep status text anchored above bus
        bus.statusText.x = bus.sprite.x;
        bus.statusText.y = bus.sprite.y - 20;
    }
}
