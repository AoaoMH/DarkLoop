/**
 * 战斗场景 - 回合制状态机驱动
 * 订阅 gameStore.turnState 变化，按 log 增量播放特效。
 * 不做规则计算，只负责"读 state + 播特效 + 通知终局"。
 */

import Phaser from 'phaser';
import { useGameStore } from '../../stores/gameStore';
import type { TurnState, TurnLogEntry } from '@shared/types';
import { battleBridge } from '../battleBridge';
import { SKILL_MAP } from '@shared/constants/skills';

const HERO_X = 200;
const ENEMY_X = 600;
const GROUND_Y_OFFSET = 140;
const BAR_WIDTH = 140;

const BUFF_EMOJIS: Record<string, string> = {
  atk_up: '⚔️',
  def_up: '🛡️',
  atk_down: '📉',
  def_down: '💔',
  stun: '💫',
  bleed: '🩸',
  burn: '🔥',
  shield: '🛡️',
  pierce: '🎯',
  charging: '⚡',
  paralyse: '⚡',
  taunt: '📢',
  indomitable: '💪',
  counter: '🤺',
  slow: '❄️',
  freeze: '🥶',
  poison: '🧪',
  curse: '💀',
  holy: '✨',
  rage_gain: '🔥',
};

const DAMAGE_TYPE_COLORS: Record<string, number> = {
  physical: 0xffffff,
  magic: 0xdc88ff,
  fire: 0xff5500,
  burn: 0xff5500,
  ice: 0x44ccff,
  freeze: 0x44ccff,
  lightning: 0xffdd00,
  paralyse: 0xffdd00,
  poison: 0x00cc33,
  shadow: 0x7722cc,
  curse: 0x7722cc,
  holy: 0xffd700,
  bleed: 0xdd0000,
};

export class BattleScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private enemy!: Phaser.GameObjects.Text;
  private heroHpBar!: Phaser.GameObjects.Rectangle;
  private enemyHpBar!: Phaser.GameObjects.Rectangle;
  private heroRageBar!: Phaser.GameObjects.Rectangle;
  private enemyNameText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  private heroHpText!: Phaser.GameObjects.Text;
  private heroRageText!: Phaser.GameObjects.Text;
  private enemyHpText!: Phaser.GameObjects.Text;
  private heroBuffsText!: Phaser.GameObjects.Text;
  private enemyBuffsText!: Phaser.GameObjects.Text;

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

    // 英雄血条 (优化高度及边框样式)
    const heroBarY = height - GROUND_Y_OFFSET + 60;
    this.add.rectangle(HERO_X, heroBarY, BAR_WIDTH, 16, 0x111115).setOrigin(0.5).setStrokeStyle(2, 0x374151);
    this.heroHpBar = this.add.rectangle(HERO_X - BAR_WIDTH / 2, heroBarY, BAR_WIDTH, 16, 0x10b981).setOrigin(0, 0.5);
    this.heroHpText = this.add.text(HERO_X, heroBarY, '', {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // 英雄怒气条
    this.add.rectangle(HERO_X, heroBarY + 18, BAR_WIDTH, 10, 0x111115).setOrigin(0.5).setStrokeStyle(2, 0x374151);
    this.heroRageBar = this.add.rectangle(HERO_X - BAR_WIDTH / 2, heroBarY + 18, 0, 10, 0xfab005).setOrigin(0, 0.5);
    this.heroRageText = this.add.text(HERO_X, heroBarY + 18, '', {
      fontSize: '9px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
    
    // 敌人血条
    const enemyBarY = height - GROUND_Y_OFFSET + 60;
    this.add.rectangle(ENEMY_X, enemyBarY, BAR_WIDTH, 16, 0x111115).setOrigin(0.5).setStrokeStyle(2, 0x374151);
    this.enemyHpBar = this.add.rectangle(ENEMY_X - BAR_WIDTH / 2, enemyBarY, BAR_WIDTH, 16, 0xef4444).setOrigin(0, 0.5);
    this.enemyHpText = this.add.text(ENEMY_X, enemyBarY, '', {
      fontSize: '11px',
      color: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Buffs 文字 (在血条上方显示)
    const heroBuffsY = height - GROUND_Y_OFFSET + 32;
    this.heroBuffsText = this.add.text(HERO_X, heroBuffsY, '', {
      fontSize: '13px',
      color: '#ffaa00',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    const enemyBuffsY = height - GROUND_Y_OFFSET + 32;
    this.enemyBuffsText = this.add.text(ENEMY_X, enemyBuffsY, '', {
      fontSize: '13px',
      color: '#ffaa00',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);



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
    this.heroRageBar.width = BAR_WIDTH * Math.min(1, ts.heroRage / ts.heroMaxRage);

    // 数值文字显示
    this.heroHpText.setText(`${Math.max(0, ts.heroHp)} / ${ts.heroMaxHp}`);
    this.heroRageText.setText(`${ts.heroRage} / ${ts.heroMaxRage}`);
    this.enemyHpText.setText(`${Math.max(0, ts.enemyHp)} / ${ts.enemyMaxHp}`);

    // Buff / Debuff 文字刷新
    const formatBuffs = (buffs: any[]) => {
      return buffs.map(b => `${BUFF_EMOJIS[b.kind] || b.kind}${b.remainingTurns}`).join('  ');
    };
    this.heroBuffsText.setText(formatBuffs(ts.heroBuffs));
    this.enemyBuffsText.setText(formatBuffs(ts.enemyBuffs));

    // 敌人
    if (this.enemy.text !== ts.enemyIcon) {
      this.enemy.setText(ts.enemyIcon);
      this.enemy.setScale(ts.enemyIsBoss ? 1.5 : 1.0);
    }
    // 防御性：确保可见（playDefeat/淡出后可能残留 alpha=0）
    if (this.enemy.alpha !== 1) this.enemy.setAlpha(1);
    if (this.hero.alpha !== 1 && ts.phase !== 'flee') this.hero.setAlpha(1);
    this.enemyNameText.setText(ts.enemyIsBoss ? `【Boss】${ts.enemyName}` : ts.enemyName);

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
    if (entry.action === 'dot') {
      await this.playDotDamage(entry);
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

  private async playDotDamage(entry: TurnLogEntry): Promise<void> {
    const isHero = entry.actor === 'hero';
    const targetObj = isHero ? this.hero : this.enemy;
    const colorMap: Record<string, { tint: number; text: string; icon: string }> = {
      '流血': { tint: 0xff3333, text: '#ff3333', icon: '🩸' },
      '燃烧': { tint: 0xff6600, text: '#ff6600', icon: '🔥' },
      '毒素': { tint: 0x33cc33, text: '#33cc33', icon: '🧪' },
    };
    const style = colorMap[entry.skillName || ''] || { tint: 0xff0000, text: '#ff0000', icon: '💥' };
    
    this.flashTint(targetObj, style.tint);
    this.shakeUnit(targetObj);
    
    if (entry.damage) {
      this.showDamageText(targetObj.x, targetObj.y - 40, `-${entry.damage}`, style.text, entry.damageType, false);
    }
    if (entry.skillName) {
      this.showFloatingText(targetObj.x, targetObj.y - 80, entry.skillName, style.text);
    }
    await this.delay(300);
  }

  private async playHeroAttack(entry: TurnLogEntry): Promise<void> {
    const originX = this.hero.x;
    await this.tweenPromise({
      targets: this.hero,
      x: originX + 30,
      duration: 100,
    });
    // 命中
    this.flashTint(this.enemy, 0xffffff);
    this.shakeUnit(this.enemy);
    if (entry.damage) this.showDamageText(this.enemy.x, this.enemy.y - 40, `-${entry.damage}`, entry.crit ? '#ff3333' : '#ff4444', entry.damageType, entry.crit);
    this.cameras.main.shake(80, 0.005);
    await this.tweenPromise({ targets: this.hero, x: originX, duration: 120 });
  }

  private async playHeroSkill(entry: TurnLogEntry): Promise<void> {
    // 技能粒子
    const skill = entry.skillId ? SKILL_MAP[entry.skillId] : null;
    this.showSkillEffect(this.enemy.x, this.enemy.y, skill?.effectName, entry.damageType);
    const originX = this.hero.x;
    await this.tweenPromise({ targets: this.hero, x: originX + 30, duration: 100 });
    this.flashTint(this.enemy, 0xffaa00);
    this.shakeUnit(this.enemy);
    if (entry.damage) this.showDamageText(this.enemy.x, this.enemy.y - 40, `-${entry.damage}`, '#ff9900', entry.damageType, true);
    if (entry.skillName) this.showFloatingText(this.hero.x, this.hero.y - 80, entry.skillName, '#ffaa00');
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
    await this.tweenPromise({ targets: this.enemy, x: originX - 30, duration: 100 });
    this.flashTint(this.hero, 0xff0000);
    this.shakeUnit(this.hero);
    if (entry.damage) this.showDamageText(this.hero.x, this.hero.y - 40, `-${entry.damage}`, '#ff5555', entry.damageType, entry.crit);
    this.cameras.main.shake(80, 0.005);
    await this.tweenPromise({ targets: this.enemy, x: originX, duration: 120 });
  }

  private async playEnemySkill(entry: TurnLogEntry): Promise<void> {
    this.showSkillEffect(this.hero.x, this.hero.y, 'scratch_01.png', entry.damageType);
    const originX = this.enemy.x;
    await this.tweenPromise({ targets: this.enemy, x: originX - 30, duration: 100 });
    this.flashTint(this.hero, 0xff0000);
    this.shakeUnit(this.hero);
    if (entry.damage) this.showDamageText(this.hero.x, this.hero.y - 40, `-${entry.damage}`, '#ff3333', entry.damageType, true);
    if (entry.skillName) this.showFloatingText(this.enemy.x, this.enemy.y - 80, entry.skillName, '#ff0000');
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

  private showDamageText(x: number, y: number, text: string, color: string, damageType?: string, big = false): void {
    const iconMap: Record<string, string> = {
      physical: '⚔️',
      magic: '🔮',
      fire: '🔥',
      ice: '❄️',
      lightning: '⚡',
      poison: '🧪',
      shadow: '💀',
      holy: '✨',
      bleed: '🩸',
      burn: '🔥',
    };
    const icon = damageType ? (iconMap[damageType] || '') : '';
    const fullText = text + icon;

    const dmg = this.add.text(x, y, fullText, {
      fontSize: big ? '26px' : '18px',
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);

    // 漂浮/抖动/弹跳 物理打击感动画
    dmg.setScale(0.5);
    this.tweens.add({
      targets: dmg,
      scale: big ? 1.4 : 1.1,
      y: y - 60,
      x: x + Phaser.Math.Between(-25, 25),
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: dmg,
          y: y - 100,
          alpha: 0,
          duration: 700,
          onComplete: () => dmg.destroy(),
        });
      }
    });
  }

  private showFloatingText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, {
      fontSize: '22px',
      color,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setScale(0.5).setDepth(30);
    this.tweens.add({
      targets: label,
      y: y - 60,
      alpha: 1,
      scale: 1.2,
      duration: 300,
      yoyo: true,
      hold: 500,
      onComplete: () => label.destroy(),
    });
  }

  private showSkillEffect(x: number, y: number, effectName: string | undefined, damageType?: string): void {
    const tintColor = damageType ? (DAMAGE_TYPE_COLORS[damageType] ?? 0xffffff) : 0xffffff;
    if (effectName && this.textures.exists(`particle_${effectName}`)) {
      const particle = this.add.image(x, y, `particle_${effectName}`).setOrigin(0.5).setDepth(20);
      particle.setScale(0.3).setAlpha(0);
      particle.setTint(tintColor);
      this.tweens.add({
        targets: particle,
        scale: 0.85,
        alpha: 1,
        duration: 200,
        yoyo: true,
        hold: 200,
        onComplete: () => particle.destroy()
      });
    } else {
      for (let i = 0; i < 6; i++) {
        const particle = this.add.circle(x, y, 2.5, tintColor).setAlpha(0.8).setDepth(20);
        const angle = (Math.PI * 2 * i) / 6;
        this.tweens.add({
          targets: particle,
          x: x + Math.cos(angle) * 25,
          y: y + Math.sin(angle) * 25,
          alpha: 0,
          scale: 0,
          duration: 400,
          onComplete: () => particle.destroy(),
        });
      }
    }
  }

  private shakeUnit(target: Phaser.GameObjects.Image | Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: target,
      x: { value: '+=10', duration: 40, yoyo: true, repeat: 3 },
    });
  }
}
