// Graphics.js - Clean building textures sized realistically to fill city blocks directly

const Graphics = {
    // Residential Mediterranean Apartment Complex directly fitting a city block
    createApartmentBlockTexture(scene, key, primaryColor, roofColor, width = 360, height = 240) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

        // Outer garden/paved courtyard base
        graphics.fillStyle(0x334155, 0.4);
        graphics.fillRect(0, 0, width, height);

        // Main building structure
        const bw = width - 40;
        const bh = height - 40;
        graphics.fillStyle(primaryColor, 1);
        graphics.fillRect(20, 20, bw, bh);

        // Terracotta / Slate roof with depth
        graphics.fillStyle(roofColor, 1);
        graphics.fillRect(15, 10, width - 30, 28);

        // Modern balcony and window rows
        graphics.fillStyle(0x1e293b, 1);
        for (let row = 50; row < height - 50; row += 40) {
            for (let col = 35; col < width - 45; col += 40) {
                // Window
                graphics.fillRect(col, row, 24, 20);
                // Balcony ledge
                graphics.fillStyle(0x64748b, 1);
                graphics.fillRect(col - 2, row + 16, 28, 4);
                graphics.fillStyle(0x1e293b, 1);
            }
        }

        // Entrance Door
        graphics.fillStyle(0x0f172a, 1);
        graphics.fillRect(width / 2 - 16, height - 25, 32, 25);

        // Entrance Canopy
        graphics.fillStyle(0x38bdf8, 0.8);
        graphics.fillRect(width / 2 - 24, height - 30, 48, 6);

        graphics.generateTexture(key, width, height);
        graphics.destroy();
        return key;
    },

    // Large Institutional Building (School / Hospital / Energy Station)
    createInstitutionTexture(scene, key, primaryColor, roofColor, width = 360, height = 240) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

        // Courtyard ground
        graphics.fillStyle(0x1e293b, 0.6);
        graphics.fillRect(0, 0, width, height);

        // Main wide building
        graphics.fillStyle(primaryColor, 1);
        graphics.fillRect(20, 30, width - 40, height - 50);

        // Roof
        graphics.fillStyle(roofColor, 1);
        graphics.fillRect(10, 15, width - 20, 25);

        // Orderly institutional windows
        graphics.fillStyle(0x0f172a, 1);
        for (let row = 55; row < height - 40; row += 35) {
            for (let col = 35; col < width - 35; col += 30) {
                graphics.fillRect(col, row, 18, 18);
            }
        }

        // Prominent entrance
        graphics.fillStyle(0x475569, 1);
        graphics.fillRect(width / 2 - 30, height - 30, 60, 30);

        graphics.generateTexture(key, width, height);
        graphics.destroy();
        return key;
    },

    // Park Block (Fills the entire block with lush greenery, trees, walking paths)
    createParkBlockTexture(scene, key, width = 360, height = 240) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

        // Lush grass
        graphics.fillStyle(0x16a34a, 1);
        graphics.fillRect(0, 0, width, height);

        // Walking paths crossing the park
        graphics.fillStyle(0xf1f5f9, 0.85);
        graphics.fillRect(0, height / 2 - 12, width, 24);
        graphics.fillRect(width / 2 - 12, 0, 24, height);

        // Circular central plaza / fountain area
        graphics.fillStyle(0x38bdf8, 1);
        graphics.fillCircle(width / 2, height / 2, 22);
        graphics.lineStyle(3, 0xffffff, 0.9);
        graphics.strokeCircle(width / 2, height / 2, 22);

        // Trees scattered naturally
        const treeCoords = [
            [40, 40], [100, 50], [40, 180], [100, 190],
            [260, 45], [320, 40], [260, 185], [320, 190],
            [width / 2 - 60, height / 2 - 45], [width / 2 + 60, height / 2 + 45]
        ];

        treeCoords.forEach(([tx, ty]) => {
            graphics.fillStyle(0x15803d, 1);
            graphics.fillCircle(tx, ty, 20);
            graphics.fillStyle(0x166534, 1);
            graphics.fillCircle(tx - 3, ty - 3, 14);
        });

        graphics.generateTexture(key, width, height);
        graphics.destroy();
        return key;
    },

    // Parking Lot Block (Fills the whole city block with parking stalls and cars)
    createParkingBlockTexture(scene, key, width = 360, height = 240) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

        // Asphalt ground
        graphics.fillStyle(0x334155, 1);
        graphics.fillRect(0, 0, width, height);

        // White parking lanes
        graphics.lineStyle(2, 0xf8fafc, 0.7);
        const carColors = [0xef4444, 0x3b82f6, 0xeab308, 0x10b981, 0x8b5cf6, 0xf97316];
        let carIdx = 0;

        for (let row of [25, 130]) {
            for (let col = 30; col < width - 40; col += 45) {
                graphics.strokeRect(col, row, 36, 60);

                // Parked cars with some empty spots
                if (carIdx % 5 !== 1 && carIdx % 7 !== 2) {
                    graphics.fillStyle(carColors[carIdx % carColors.length], 1);
                    graphics.fillRect(col + 5, row + 8, 26, 44);
                    // Windshield
                    graphics.fillStyle(0x0f172a, 1);
                    graphics.fillRect(col + 7, row + 14, 22, 10);
                }
                carIdx++;
            }
        }

        graphics.generateTexture(key, width, height);
        graphics.destroy();
        return key;
    },

    // Bus Stop Texture (Interactive roadside stop)
    createBusStopTexture(scene) {
        const width = 48;
        const height = 32;
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

        // Signpost / Shelter
        graphics.fillStyle(0x0284c7, 1);
        graphics.fillRect(4, 2, 40, 8); // Roof
        graphics.fillStyle(0x94a3b8, 0.6);
        graphics.fillRect(6, 10, 36, 16); // Glass panel
        graphics.fillStyle(0xfacc15, 1);
        graphics.fillRect(42, 6, 4, 24); // Bus sign pole
        graphics.fillCircle(44, 4, 6); // Yellow sign disc

        graphics.generateTexture('loc_busStop', width, height);
        graphics.destroy();
        return 'loc_busStop';
    },

    // Vehicle Sprites
    createCarTexture(scene, key, color) {
        const width = 34;
        const height = 18;
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

        // Car main body
        graphics.fillStyle(color, 1);
        graphics.fillRect(2, 1, width - 4, height - 2);

        // Roof / cabin
        graphics.fillStyle(0x0f172a, 0.35);
        graphics.fillRect(8, 3, width - 18, height - 6);

        // Front Windshield (Facing East / Right)
        graphics.fillStyle(0x7dd3fc, 1);
        graphics.fillRect(width - 13, 3, 4, height - 6);

        // Rear Window
        graphics.fillRect(7, 3, 3, height - 6);

        // Side windows
        graphics.fillRect(10, 2, width - 20, 2);
        graphics.fillRect(10, height - 4, width - 20, 2);

        // Front Headlights (Bright White/Yellow)
        graphics.fillStyle(0xfef08a, 1);
        graphics.fillRect(width - 2, 2, 2, 3);
        graphics.fillRect(width - 2, height - 5, 2, 3);

        // Rear Taillights (Red)
        graphics.fillStyle(0xef4444, 1);
        graphics.fillRect(0, 2, 2, 3);
        graphics.fillRect(0, height - 5, 2, 3);

        graphics.generateTexture(key, width, height);
        graphics.destroy();
        return key;
    },

    // Public Transit Bus (Longer vehicle with visible passenger windows)
    createBusTexture(scene, key = 'bus_transit') {
        const width = 56;
        const height = 22;
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

        // Bus Body (Clean Eco-Green Transit)
        graphics.fillStyle(0x059669, 1);
        graphics.fillRect(2, 1, width - 4, height - 2);

        // White Roof Line
        graphics.fillStyle(0xf8fafc, 1);
        graphics.fillRect(8, 3, width - 18, height - 6);

        // AC units / vents on roof
        graphics.fillStyle(0x94a3b8, 1);
        graphics.fillRect(16, 5, 8, height - 10);
        graphics.fillRect(30, 5, 8, height - 10);

        // Front Windshield (East)
        graphics.fillStyle(0x38bdf8, 1);
        graphics.fillRect(width - 9, 3, 6, height - 6);

        // LED Destination Display (Orange/Amber)
        graphics.fillStyle(0xf59e0b, 1);
        graphics.fillRect(width - 11, 6, 2, height - 12);

        // Passenger Windows (both sides)
        graphics.fillStyle(0x0284c7, 0.9);
        for (let wx = 10; wx < width - 14; wx += 6) {
            graphics.fillRect(wx, 2, 4, 2);
            graphics.fillRect(wx, height - 4, 4, 2);
        }

        // Headlights
        graphics.fillStyle(0xfef08a, 1);
        graphics.fillRect(width - 2, 2, 2, 4);
        graphics.fillRect(width - 2, height - 6, 2, 4);

        // Taillights
        graphics.fillStyle(0xef4444, 1);
        graphics.fillRect(0, 2, 2, 4);
        graphics.fillRect(0, height - 6, 2, 4);

        graphics.generateTexture(key, width, height);
        graphics.destroy();
        return key;
    },

    // Pedestrian Sprites
    createPedestrianTexture(scene, key, clothesColor) {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xfde047, 1);
        graphics.fillCircle(8, 5, 4);
        graphics.fillStyle(clothesColor, 1);
        graphics.fillRect(4, 10, 8, 11);
        graphics.fillStyle(0x1e293b, 1);
        graphics.fillRect(5, 21, 2, 7);
        graphics.fillRect(9, 21, 2, 7);

        graphics.generateTexture(key, 16, 28);
        graphics.destroy();
        return key;
    },

    // Urban Planning Infrastructures
    createSaplingTexture(scene, key = 'item_sapling') {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x78350f, 1); // Brown stem
        graphics.fillRect(7, 8, 2, 8);
        graphics.fillStyle(0x22c55e, 1); // Young green leaves
        graphics.fillCircle(8, 6, 5);
        graphics.fillStyle(0x16a34a, 1);
        graphics.fillCircle(6, 5, 3);
        graphics.generateTexture(key, 16, 18);
        graphics.destroy();
        return key;
    },

    createMatureTreeTexture(scene, key = 'item_tree_mature') {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x451a03, 1); // Thick trunk
        graphics.fillRect(14, 22, 6, 12);
        graphics.fillStyle(0x15803d, 1); // Broad lush shade canopy
        graphics.fillCircle(17, 14, 15);
        graphics.fillStyle(0x16a34a, 0.9);
        graphics.fillCircle(14, 11, 10);
        graphics.fillStyle(0x166534, 0.7);
        graphics.fillCircle(20, 16, 9);
        graphics.generateTexture(key, 34, 36);
        graphics.destroy();
        return key;
    },

    createBikeLaneTexture(scene, key = 'item_bikeLane') {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x059669, 0.85); // Green lane paint
        graphics.fillRect(0, 0, 36, 18);
        graphics.lineStyle(1, 0xffffff, 0.9);
        graphics.strokeCircle(10, 9, 4); // Bike wheels
        graphics.strokeCircle(24, 9, 4);
        graphics.fillStyle(0xffffff, 1); // Bike frame
        graphics.fillRect(10, 8, 14, 2);
        graphics.generateTexture(key, 36, 18);
        graphics.destroy();
        return key;
    },

    createAwningTexture(scene, key = 'item_awning') {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0xe11d48, 1); // Striped awning
        graphics.fillRect(0, 0, 32, 14);
        graphics.fillStyle(0xffffff, 0.8);
        for (let x = 4; x < 32; x += 8) {
            graphics.fillRect(x, 0, 4, 14);
        }
        graphics.generateTexture(key, 32, 14);
        graphics.destroy();
        return key;
    },

    createSolarRoofTexture(scene, key = 'item_solarRoof') {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x1e3a8a, 1); // Deep blue photovoltaic
        graphics.fillRect(0, 0, 44, 22);
        graphics.lineStyle(1, 0x60a5fa, 0.8);
        for (let x = 11; x < 44; x += 11) {
            graphics.lineBetween(x, 0, x, 22);
        }
        graphics.lineBetween(0, 11, 44, 11);
        graphics.generateTexture(key, 44, 22);
        graphics.destroy();
        return key;
    },

    createGreenRoofTexture(scene, key = 'item_greenRoof') {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x15803d, 1); // Rooftop turf/sedum
        graphics.fillRect(0, 0, 44, 22);
        graphics.fillStyle(0x86efac, 0.8);
        for (let i = 4; i < 40; i += 8) {
            graphics.fillCircle(i + 2, 6, 3);
            graphics.fillCircle(i + 4, 16, 3);
        }
        graphics.generateTexture(key, 44, 22);
        graphics.destroy();
        return key;
    },

    createFountainTexture(scene, key = 'item_fountain') {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        graphics.fillStyle(0x94a3b8, 1); // Stone basin
        graphics.fillCircle(16, 16, 15);
        graphics.fillStyle(0x0284c7, 1); // Water pool
        graphics.fillCircle(16, 16, 11);
        graphics.fillStyle(0x38bdf8, 1); // Center bubbling jet
        graphics.fillCircle(16, 16, 5);
        graphics.lineStyle(2, 0xffffff, 0.8);
        graphics.strokeCircle(16, 16, 8);
        graphics.generateTexture(key, 32, 32);
        graphics.destroy();
        return key;
    },

    preloadAssets(scene) {
        this.createApartmentBlockTexture(scene, 'loc_residential_2016', 0xf1f5f9, 0xe11d48);
        this.createApartmentBlockTexture(scene, 'loc_residential_2026', 0xe2e8f0, 0x991b1b);

        this.createInstitutionTexture(scene, 'loc_school', 0xf8fafc, 0x0284c7);
        this.createInstitutionTexture(scene, 'loc_hospital', 0xf8fafc, 0xd97706);
        this.createInstitutionTexture(scene, 'loc_coolingCenter', 0xf8fafc, 0x0d9488);
        this.createInstitutionTexture(scene, 'loc_energyStation', 0xf8fafc, 0xca8a04);

        this.createParkBlockTexture(scene, 'loc_park');
        this.createParkingBlockTexture(scene, 'loc_parkingLot');
        this.createBusStopTexture(scene);

        this.createCarTexture(scene, 'car_red', 0xef4444);
        this.createCarTexture(scene, 'car_blue', 0x3b82f6);
        this.createCarTexture(scene, 'car_yellow', 0xeab308);
        this.createBusTexture(scene, 'bus_transit');

        this.createPedestrianTexture(scene, 'ped_general', 0x38bdf8);
        this.createPedestrianTexture(scene, 'char_meryem', 0xf43f5e);
        this.createPedestrianTexture(scene, 'char_deniz', 0x0ea5e9);
        this.createPedestrianTexture(scene, 'char_elif', 0xa855f7);
        this.createPedestrianTexture(scene, 'char_ayse', 0x10b981);
        this.createPedestrianTexture(scene, 'char_hasan', 0xf97316);
        this.createPedestrianTexture(scene, 'char_zeynep', 0x0d9488);

        this.createSaplingTexture(scene);
        this.createMatureTreeTexture(scene);
        this.createBikeLaneTexture(scene);
        this.createAwningTexture(scene);
        this.createSolarRoofTexture(scene);
        this.createGreenRoofTexture(scene);
        this.createFountainTexture(scene);
    }
};
