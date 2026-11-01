const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1280,
    height: 720,
    backgroundColor: '#2d1b00',
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MenuScene, GameScene]
};

window.game = new Phaser.Game(config);

// Debug helpers
window.showDebug = false;
if (location.hash === '#debug') {
    console.log('Debug mode enabled');
    window.showDebug = true;
}
