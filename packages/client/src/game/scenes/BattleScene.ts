/**
 * 战斗场景 - 回合制状态机驱动
 * 订阅 gameStore.turnState 变化，按 log 增量播放特效。
 * 不做规则计算，只负责"读 state + 播特效 + 通知终局"。
 */

import Phaser from 'phaser';
import { useGameStore } from '../../stores/gameStore';
import type { TurnState, TurnLogEntry } from '@shared/types';
import { battleBridge } from '../battleBridge';

const HERO_X = 200;
const ENEMY_X = 600;
const GROUND_Y_OFFSET = 140;
const BAR_WIDTH = 140;

export class BattleScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private enemy!: Phaser.GameObjects.Text;
  private heroHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private heroRageBar!: Phaser.GameObjects.Rectangle;
  private enemyNameText!: Phaser.GameObjects.Text;
  private stepText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  private lastLogLen = 0;
  private isAnimating = false;
  private pendingState: TurnState | null = null;
  private unsub: (() => void) | null = null;
  private currentWaveIndex = -1;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // 地面
    this.add.rectangle(width / 2, height - 60, width, 120, 0x2d2d44).setOrigin(0.5);

    // 英雄（左侧）
    this.hero = this.add.image(HERO_X, height - GROUND_Y_OFFSET, 'hero_warrior');
    this.hero.setScale(3);

    // 敌人（右侧，emoji 文本）
    this.enemy = this.add.text(ENEMY_X, height - GROUND_Y_OFFSET, '🟢', {
      fontSize: '64px',
    }).setOrigin(0.5);

    // 敌人名称
    this.enemyNameText = this.add.text(ENEMY_X, height - GROUND_Y_OFFSET - 70, '', {
      fontSize: '16px',
      color: '#ff6666',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // 英雄血条
    this.add.rectangle(HERO_X, height - GROUND_Y_OFFSET - 55, BAR_WIDTH, 10, 0x333333).setOrigin(0.5);
    this.heroHpBar = this.add.rectangle(HERO_X - BAR_WIDTH / 2, height - GROUND_Y_OFFSET - 55, BAR_WIDTH, 10, 0x00ff88).setOrigin(0, 0.5);

    // 英雄怒气条
    this.add.rectangle(HERO_X, height - GROUND_Y_OFFSET - 42, BAR_WIDTH, 6, 0x333333).setOrigin(0.5);
    this.heroRageBar = this.add.rectangle(HERO_X - BAR_WIDTH / 2, height - GROUND_Y_OFFSET - 42, 0, 6, 0xffaa00).setOrigin(0, 0.5);
    this.add.text(HERO_X, height - GROUND_Y_OFFSET - 30, '怒气', {
      fontSize: '10px',
      color: '#ffaa00',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 敌人血条
    this.add.rectangle(ENEMY_X, height - GROUND_Y_OFFSET - 55, BAR_WIDTH, 10, 0x333333).setOrigin(0.5);
    this.enemyHpBar = this.add.rectangle(ENEMY_X - BAR_WIDTH / 2, height - GROUND_Y_OFFSET - 55, BAR_WIDTH, 10, 0xff4444).setOrigin(0, 0.5);

    // 顶部 Step
    this.stepText = this.add.text(width / 2, 30, '', {
      fontSize: '18px',
      color: '#ffd700',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // 相位提示
    this.phaseText = this.add.text(width / 2, 55, '', {
      fontSize: '12px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 订阅 store
    this.unsub = useGameStore.subscribe((state, prev) => {
      if (state.turnState !== prev.turnState) {
        this.onTurnStateChanged(state.turnState);
      }
    });

    // 初始渲染
    const ts = useGameStore.getState().turnState;
    if (ts) {
      this.lastLogLen = ts.log.length;
      this.currentWaveIndex = ts.waveIndex;
      this.refreshScene(ts);
      // 敌方先手：启动敌方回合
      if (ts.phase === 'enemy') {
        void this.handlePhase(ts);
      }
    }

    // 监听场景关闭
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    this.unsub?.();
    this.unsub = null;
    battleBridge.removeAllListeners('battle-end');
  }

  private async onTurnStateChanged(ts: TurnState | null): Promise<void> {
    if (!ts) return;
    if (this.isAnimating) {
      this.pendingState = ts;
      return;
    }
    this.isAnimating = true;

    const newLogs = ts.log.slice(this.lastLogLen);
    this.lastLogLen = ts.log.length;

    // 波次切换：waveIndex 变化且无新行动 log → 只刷新场景
    if (ts.waveIndex !== this.currentWaveIndex && newLogs.length === 0) {
      this.currentWaveIndex = ts.waveIndex;
      await this.playWaveTransition(ts);
      this.refreshScene(ts);
      // 新波次可能敌方先手
      await this.handlePhase(ts);
      this.isAnimating = false;
      return;
    }

    // 顺序播放新增 log 特效
    for (const entry of newLogs) {
      await this.playLogEntry(entry);
    }

    this.refreshScene(ts);
    this.currentWaveIndex = ts.waveIndex;

    // 终局处理
    await this.handlePhase(ts);

    this.isAnimating = false;
    if (this.pendingState) {
      const next = this.pendingState;
      this.pendingState = null;
      void this.onTurnStateChanged(next);
    }
  }

  private refreshScene(ts: TurnState): void {
    // 血条
    this.heroHpBar.width = BAR_WIDTH * Math.max(0, ts.heroHp / ts.heroMaxHp);
    this.enemyHpBar.width = BAR_WIDTH * Math.max(0, ts.enemyHp / ts.enemyMaxHp);
    // 怒气条
    this.heroRageBar.width = BAR_WIDTH * Math.min(1, ts.heroRage / 100);
    // 敌人
    if (this.enemy.text !== ts.enemyIcon) {
      this.enemy.setText(ts.enemyIcon);
      this.enemy.setScale(ts.enemyIsBoss ? 1.5 : 1.0);
    }
    // 防御性：确保可见（playDefeat/淡出后可能残留 alpha=0）
    if (this.enemy.alpha !== 1) this.enemy.setAlpha(1);
    if (this.hero.alpha !== 1 && ts.phase !== 'flee') this.hero.setAlpha(1);
    this.enemyNameText.setText(ts.enemyIsBoss ? `【Boss】${ts.enemyName}` : ts.enemyName);
    // Step
    this.stepText.setText(`第 ${ts.waveIndex + 1} / ${ts.totalWaves} 波`);
    // 相位
    const phaseLabel = ts.phase === 'player' ? '你的回合' : ts.phase === 'enemy' ? '敌方回合' : ts.phase === 'anim' ? '波次推进…' : '';
    this.phaseText.setText(phaseLabel);
  }

  private async playWaveTransition(ts: TurnState): Promise<void> {
    // 旧敌人淡出
    await this.tweenPromise({
      targets: this.enemy,
      alpha: 0,
      scale: 0,
      duration: 250,
    });
    // 更新为新敌人
    this.enemy.setText(ts.enemyIcon);
    this.enemyNameText.setText(ts.enemyIsBoss ? `【Boss】${ts.enemyName}` : ts.enemyName);
    this.enemyHpBar.width = BAR_WIDTH;
    // 淡入
    this.enemy.setAlpha(0).setScale(0);
    await this.tweenPromise({
      targets: this.enemy,
      alpha: 1,
      scale: ts.enemyIsBoss ? 1.5 : 1.0,
      duration: 300,
    });
  }

  private async playLogEntry(entry: TurnLogEntry): Promise<void> {
    if (entry.defeated) {
      await this.playDefeat(entry);
      return;
    }
    if (entry.actor === 'hero') {
      switch (entry.action) {
        case 'attack': await this.playHeroAttack(entry); break;
        case 'skill': await this.playHeroSkill(entry); break;
        case 'defend': await this.playHeroDefend(entry); break;
        case 'flee': await this.playHeroFlee(entry); break;
      }
    } else {
      switch (entry.action) {
        case 'attack': await this.playEnemyAttack(entry); break;
        case 'skill': await this.playEnemySkill(entry); break;
      }
    }
  }

  private async playHeroAttack(entry: TurnLogEntry): Promise<void> {
    const originX = this.hero.x;
    await this.tweenPromise({
      targets: this.hero,
      x: this.enemy.x - 80,
      duration: 120,
    });
    // 命中
    this.flashTint(this.enemy, 0xffffff);
    if (entry.damage) this.showDamageText(this.enemy.x, this.enemy.y - 40, `-${entry.damage}`, entry.crit ? '#ff3333' : '#ff4444', entry.crit);
    this.cameras.main.shake(80, 0.005);
    await this.tweenPromise({ targets: this.hero, x: originX, duration: 120 });
  }

  private async playHeroSkill(entry: TurnLogEntry): Promise<void> {
    // 技能粒子
    this.showSkillEffect(this.enemy.x, this.enemy.y, 0xff6600);
    const originX = this.hero.x;
    await this.tweenPromise({ targets: this.hero, x: this.enemy.x - 60, duration: 100 });
    this.flashTint(this.enemy, 0xffaa00);
    if (entry.damage) this.showDamageText(this.enemy.x, this.enemy.y - 40, `-${entry.damage}`, '#ff3333', true);
    if (entry.skillName) this.showFloatingText(this.hero.x, this.hero.y - 60, entry.skillName, '#ffaa00');
    this.cameras.main.shake(120, 0.008);
    await this.tweenPromise({ targets: this.hero, x: originX, duration: 120 });
  }

  private async playHeroDefend(_entry: TurnLogEntry): Promise<void> {
    const shield = this.add.text(this.hero.x, this.hero.y - 30, '🛡️', { fontSize: '32px' }).setOrigin(0.5).setAlpha(0);
    await this.tweenPromise({ targets: shield, alpha: 1, duration: 150, yoyo: true });
    shield.destroy();
  }

  private async playHeroFlee(_entry: TurnLogEntry): Promise<void> {
    const smoke = this.add.text(this.hero.x, this.hero.y, '💨', { fontSize: '48px' }).setOrigin(0.5).setAlpha(0);
    await this.tweenPromise({ targets: [this.hero, smoke], alpha: 0, duration: 300 });
  }

  private async playEnemyAttack(entry: TurnLogEntry): Promise<void> {
    const originX = this.enemy.x;
    await this.tweenPromise({ targets: this.enemy, x: this.hero.x + 80, duration: 120 });
    this.flashTint(this.hero, 0xff0000);
    if (entry.damage) this.showDamageText(this.hero.x, this.hero.y - 40, `-${entry.damage}`, '#ff5555');
    this.cameras.main.shake(80, 0.005);
    await this.tweenPromise({ targets: this.enemy, x: originX, duration: 120 });
  }

  private async playEnemySkill(entry: TurnLogEntry): Promise<void> {
    this.showSkillEffect(this.hero.x, this.hero.y, 0xff0000);
    const originX = this.enemy.x;
    await this.tweenPromise({ targets: this.enemy, x: this.hero.x + 60, duration: 100 });
    this.flashTint(this.hero, 0xff0000);
    if (entry.damage) this.showDamageText(this.hero.x, this.hero.y - 40, `-${entry.damage}`, '#ff0000', true);
    if (entry.skillName) this.showFloatingText(this.enemy.x, this.enemy.y - 60, entry.skillName, '#ff0000');
    this.cameras.main.shake(140, 0.01);
    await this.tweenPromise({ targets: this.enemy, x: originX, duration: 120 });
  }

  private async playDefeat(entry: TurnLogEntry): Promise<void> {
    const target = entry.actor === 'hero' ? this.hero : this.enemy;
    this.showFloatingText(target.x, target.y - 60, '击败!', '#00ff88');
    await this.tweenPromise({
      targets: target,
      alpha: 0,
      scale: 0,
      duration: 300,
      onComplete: () => {
        target.setAlpha(1);
        if (target instanceof Phaser.GameObjects.Image) target.setScale(3);
        if (target instanceof Phaser.GameObjects.Text) target.setScale(1);
      },
    });
  }

  private async handlePhase(ts: TurnState): Promise<void> {
    if (ts.phase === 'enemy') {
      await this.delay(800);
      useGameStore.getState().enemyTurn();
    } else if (ts.phase === 'anim') {
      await this.delay(400);
      useGameStore.getState().advanceWave();
    } else if (ts.phase === 'win') {
      await this.delay(300);
      battleBridge.emit('battle-end', 'win');
    } else if (ts.phase === 'lose') {
      this.cameras.main.flash(300, 100, 0, 0);
      await this.delay(400);
      battleBridge.emit('battle-end', 'lose');
    } else if (ts.phase === 'flee') {
      await this.delay(300);
      battleBridge.emit('battle-end', 'flee');
    }
  }

  // ─── 特效工具 ──────────────────────────────────────────

  private tweenPromise(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      const userOnComplete = cfg.onComplete as ((...args: unknown[]) => void) | undefined;
      this.tweens.add({
        ...cfg,
        onComplete: (tween: Phaser.Tweens.Tween, targets: unknown[]) => {
          if (typeof userOnComplete === 'function') userOnComplete(tween, targets);
          resolve();
        },
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, () => resolve()));
  }

  private flashTint(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text, color: number): void {
    obj.setTint(color);
    this.time.delayedCall(100, () => obj.clearTint());
  }

  private showDamageText(x: number, y: number, text: string, color: string, big = false): void {
    const dmg = this.add.text(x, y, text, {
      fontSize: big ? '24px' : '18px',
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: dmg,
      y: y - 50,
      alpha: 0,
      duration: 900,
      onComplete: () => dmg.destroy(),
    });
  }

  private showFloatingText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, {
      fontSize: '14px',
      color,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: label,
      y: y - 30,
      alpha: 1,
      duration: 200,
      yoyo: true,
      onComplete: () => label.destroy(),
    });
  }

  private showSkillEffect(x: number, y: number, color: number): void {
    for (let i = 0; i < 6; i++) {
      const particle = this.add.circle(x, y, 4, color).setAlpha(0.8);
      const angle = (Math.PI * 2 * i) / 6;
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0,
        duration: 400,
        onComplete: () => particle.destroy(),
      });
    }
  }
}
