/**
 * Boot 场景 - 加载资源、初始化全局配置
 */

import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 进度条
    const { width, height } = this.cameras.main;
    const barW = 300;
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(barX, barY, barW, barH, 0x222222).setOrigin(0);
    const fill = this.add.rectangle(barX, barY, 0, barH, 0x00ff88).setOrigin(0);

    this.load.on('progress', (v: number) => {
      fill.width = barW * v;
    });

    // 加载像素风精灵图
    this.load.image('hero_warrior', 'assets/sprites/hero_warrior.png');
    this.load.image('monster_slime', 'assets/sprites/monster_slime.png');
    this.load.image('monster_demon', 'assets/sprites/monster_demon.png');
    this.load.image('item_potion', 'assets/sprites/item_potion.png');
    this.load.image('tilemap', 'assets/sprites/tilemap.png');
  }

  create(): void {
    this.scene.start('BattleScene');
  }
}
