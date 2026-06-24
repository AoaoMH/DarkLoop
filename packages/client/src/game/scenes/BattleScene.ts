/**
 * 战斗场景 - 回合制状态机驱动（多敌人 + 精灵点击选目标）
 *
 * 左侧：英雄精灵
 * 右侧：多个敌人精灵（水平排列），可点击选择目标
 *
 * 通信：
 *   DOM → Phaser: battleBridge 'target-request' / 'target-cancel'
 *   Phaser → DOM: battleBridge 'target-selected' / 'battle-end'
 */

import Phaser from 'phaser';
import { useGameStore } from '../../stores/gameStore';
import type { TurnState, TurnLogEntry, EnemyCombatState } from '@shared/types';
import { battleBridge } from '../battleBridge';
import { SKILL_MAP } from '@shared/constants/skills';

const HERO_X = 180;
const ENEMY_BASE_X = 580;
const BATTLE_CENTER_Y_OFFSET = 0; // 垂直居中
const BAR_WIDTH = 120;
const ENEMY_SPACING = 140;

const BUFF_EMOJIS: Record<string, string> = {
  atk_up: '⚔️', def_up: '🛡️', atk_down: '📉', def_down: '💔',
  stun: '💫', bleed: '🩸', burn: '🔥', shield: '🛡️', pierce: '🎯',
  charging: '⚡', paralyse: '⚡', taunt: '📢', indomitable: '💪',
  counter: '🤺', slow: '❄️', freeze: '🥶', poison: '🧪', curse: '💀',
  holy: '✨', rage_gain: '🔥',
};

const DAMAGE_TYPE_COLORS: Record<string, number> = {
  physical: 0xffffff, magic: 0xdc88ff, fire: 0xff5500, burn: 0xff5500,
  ice: 0x44ccff, freeze: 0x44ccff, lightning: 0xffdd00, paralyse: 0xffdd00,
  poison: 0x00cc33, shadow: 0x7722cc, curse: 0x7722cc, holy: 0xffd700, bleed: 0xdd0000,
};

interface EnemyDisplay {
  uid: string;
  sprite: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBarBg: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  buffsText: Phaser.GameObjects.Text;
  x: number;
  y: number;
}

export class BattleScene extends Phaser.Scene {
  private hero!: Phaser.GameObjects.Image;
  private heroHpBar!: Phaser.GameObjects.Rectangle;
  private heroRageBar!: Phaser.GameObjects.Rectangle;
  private heroHpText!: Phaser.GameObjects.Text;
  private heroRageText!: Phaser.GameObjects.Text;
  private heroBuffsText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  private enemyDisplays = new Map<string, EnemyDisplay>();
  private lastLogLen = 0;
  private isAnimating = false;
  private pendingState: TurnState | null = null;
  private unsub: (() => void) | null = null;
  private currentWaveIndex = -1;
  private targetingActive = false;

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const centerY = height / 2 - BATTLE_CENTER_Y_OFFSET;

    // 英雄
    this.hero = this.add.image(HERO_X, centerY, 'hero_warrior');
    this.hero.setScale(3);

    // 英雄血条
    const heroBarY = centerY + 60;
    this.add.rectangle(HERO_X, heroBarY, BAR_WIDTH, 16, 0x111115).setOrigin(0.5).setStrokeStyle(2, 0x374151);
    this.heroHpBar = this.add.rectangle(HERO_X - BAR_WIDTH / 2, heroBarY, BAR_WIDTH, 16, 0x10b981).setOrigin(0, 0.5);
    this.heroHpText = this.add.text(HERO_X, heroBarY, '', {
      fontSize: '11px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // 英雄怒气条
    this.add.rectangle(HERO_X, heroBarY + 18, BAR_WIDTH, 10, 0x111115).setOrigin(0.5).setStrokeStyle(2, 0x374151);
    this.heroRageBar = this.add.rectangle(HERO_X - BAR_WIDTH / 2, heroBarY + 18, 0, 10, 0xfab005).setOrigin(0, 0.5);
    this.heroRageText = this.add.text(HERO_X, heroBarY + 18, '', {
      fontSize: '9px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // 英雄 Buff
    this.heroBuffsText = this.add.text(HERO_X, centerY + 32, '', {
      fontSize: '13px', color: '#ffaa00', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // 相位提示
    this.phaseText = this.add.text(width / 2, 30, '', {
      fontSize: '12px', color: '#888888', fontFamily: 'monospace',
    }).setOrigin(0.5);

    // 订阅 store
    this.unsub = useGameStore.subscribe((state, prev) => {
      if (state.turnState !== prev.turnState) {
        this.onTurnStateChanged(state.turnState);
      }
    });

    // battleBridge 事件
    battleBridge.on('target-request', this.onTargetRequest, this);
    battleBridge.on('target-cancel', this.onTargetCancel, this);

    // 初始渲染
    const ts = useGameStore.getState().turnState;
    if (ts) {
      this.lastLogLen = ts.log.length;
      this.currentWaveIndex = ts.waveIndex;
      this.rebuildEnemies(ts);
      this.refreshScene(ts);
      if (ts.phase === 'enemy') {
        void this.handlePhase(ts);
      }
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private cleanup(): void {
    this.unsub?.();
    this.unsub = null;
    battleBridge.off('target-request', this.onTargetRequest, this);
    battleBridge.off('target-cancel', this.onTargetCancel, this);
    battleBridge.removeAllListeners('battle-end');
    battleBridge.removeAllListeners('target-selected');
  }

  // ─── 目标选择 ─────────────────────────────────────────

  private onTargetRequest(): void {
    this.targetingActive = true;
    for (const [uid, display] of this.enemyDisplays) {
      const enemy = useGameStore.getState().turnState?.enemies.find(e => e.uid === uid);
      if (enemy?.alive) {
        display.sprite.setInteractive({ useHandCursor: true });
        // 脉冲高亮
        this.tweens.add({
          targets: display.sprite,
          scale: { value: 1.15, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' },
        });
      }
    }
  }

  private onTargetCancel(): void {
    this.targetingActive = false;
    for (const [, display] of this.enemyDisplays) {
      display.sprite.disableInteractive();
      this.tweens.killTweensOf(display.sprite);
      // 恢复原始缩放
      const enemy = useGameStore.getState().turnState?.enemies.find(e => e.uid === display.uid);
      display.sprite.setScale(enemy?.isBoss ? 1.5 : 1.0);
    }
  }

  private onEnemySpriteClick(uid: string): void {
    if (!this.targetingActive) return;
    this.onTargetCancel();
    battleBridge.emit('target-selected', { uid });
  }

  // ─── 敌人显示管理 ─────────────────────────────────────

  private rebuildEnemies(ts: TurnState): void {
    // 清除旧敌人
    this.clearEnemyDisplays();

    const { height } = this.cameras.main;
    const centerY = height / 2 - BATTLE_CENTER_Y_OFFSET;
    const count = ts.enemies.length;
    // 水平排列
    const startX = ENEMY_BASE_X - (count - 1) * ENEMY_SPACING / 2;

    for (let i = 0; i < count; i++) {
      const enemy = ts.enemies[i];
      const x = startX + i * ENEMY_SPACING;
      this.createEnemyDisplay(enemy, x, centerY);
    }
  }

  private createEnemyDisplay(enemy: EnemyCombatState, x: number, y: number): void {
    const scale = enemy.isBoss ? 1.5 : 1.0;

    // 精灵
    const sprite = this.add.text(x, y, enemy.icon, {
      fontSize: '56px',
    }).setOrigin(0.5).setScale(scale);

    // 名称
    const nameText = this.add.text(x, y - 50, '', {
      fontSize: '14px', color: '#ff6666', fontFamily: 'monospace',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // 血条背景
    const hpBarBg = this.add.rectangle(x, y + 45, BAR_WIDTH, 14, 0x111115)
      .setOrigin(0.5).setStrokeStyle(2, 0x374151);

    // 血条
    const hpBar = this.add.rectangle(x - BAR_WIDTH / 2, y + 45, BAR_WIDTH, 14, 0xef4444)
      .setOrigin(0, 0.5);

    // HP 文字
    const hpText = this.add.text(x, y + 45, '', {
      fontSize: '10px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    // Buff
    const buffsText = this.add.text(x, y + 65, '', {
      fontSize: '12px', color: '#ffaa00', fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    const display: EnemyDisplay = { uid: enemy.uid, sprite, hpBar, hpBarBg, nameText, hpText, buffsText, x, y };
    this.enemyDisplays.set(enemy.uid, display);

    // 点击事件
    sprite.on('pointerdown', () => this.onEnemySpriteClick(enemy.uid));

    // 死亡的敌人半透明
    if (!enemy.alive) {
      sprite.setAlpha(0.3);
    }

    this.updateEnemyDisplay(display, enemy);
  }

  private updateEnemyDisplay(display: EnemyDisplay, enemy: EnemyCombatState): void {
    display.nameText.setText(enemy.isBoss ? `【Boss】${enemy.name} Lv.${enemy.level}` : `${enemy.name} Lv.${enemy.level}`);
    display.hpBar.width = BAR_WIDTH * Math.max(0, enemy.hp / enemy.maxHp);
    display.hpText.setText(`${Math.max(0, enemy.hp)}/${enemy.maxHp}`);

    const formatBuffs = (buffs: any[]) =>
      buffs.map(b => `${BUFF_EMOJIS[b.kind] || b.kind}${b.remainingTurns}`).join(' ');
    display.buffsText.setText(formatBuffs(enemy.buffs));

    if (enemy.icon !== display.sprite.text) {
      display.sprite.setText(enemy.icon);
    }

    if (!enemy.alive) {
      display.sprite.setAlpha(0.25);
    } else if (display.sprite.alpha < 1) {
      display.sprite.setAlpha(1);
    }
  }

  private clearEnemyDisplays(): void {
    for (const [, display] of this.enemyDisplays) {
      display.sprite.destroy();
      display.hpBar.destroy();
      display.hpBarBg.destroy();
      display.nameText.destroy();
      display.hpText.destroy();
      display.buffsText.destroy();
    }
    this.enemyDisplays.clear();
  }

  private getEnemyDisplay(uid: string): EnemyDisplay | undefined {
    return this.enemyDisplays.get(uid);
  }

  // ─── 状态变更 ─────────────────────────────────────────

  private async onTurnStateChanged(ts: TurnState | null): Promise<void> {
    if (!ts) return;
    if (this.isAnimating) {
      this.pendingState = ts;
      return;
    }
    this.isAnimating = true;

    const newLogs = ts.log.slice(this.lastLogLen);
    this.lastLogLen = ts.log.length;

    // 播放新增 log
    for (const entry of newLogs) {
      await this.playLogEntry(entry, ts);
    }

    // 检测波次切换（敌人 UID 变化）
    const currentUids = new Set(this.enemyDisplays.keys());
    const newUids = new Set(ts.enemies.map(e => e.uid));
    const enemiesChanged = currentUids.size !== newUids.size
      || [...newUids].some(uid => !currentUids.has(uid));

    if (enemiesChanged) {
      await this.playWaveTransition(ts);
    }

    this.refreshScene(ts);
    this.currentWaveIndex = ts.waveIndex;
    await this.handlePhase(ts);

    this.isAnimating = false;
    if (this.pendingState) {
      const next = this.pendingState;
      this.pendingState = null;
      void this.onTurnStateChanged(next);
    }
  }

  private refreshScene(ts: TurnState): void {
    // 英雄
    this.heroHpBar.width = BAR_WIDTH * Math.max(0, ts.heroHp / ts.heroMaxHp);
    this.heroRageBar.width = BAR_WIDTH * Math.min(1, ts.heroRage / ts.heroMaxRage);
    this.heroHpText.setText(`${Math.max(0, ts.heroHp)}/${ts.heroMaxHp}`);
    this.heroRageText.setText(`${ts.heroRage}/${ts.heroMaxRage}`);

    const formatBuffs = (buffs: any[]) =>
      buffs.map(b => `${BUFF_EMOJIS[b.kind] || b.kind}${b.remainingTurns}`).join(' ');
    this.heroBuffsText.setText(formatBuffs(ts.heroBuffs));

    if (this.hero.alpha !== 1 && ts.phase !== 'flee') this.hero.setAlpha(1);

    // 敌人
    for (const enemy of ts.enemies) {
      const display = this.getEnemyDisplay(enemy.uid);
      if (display) {
        this.updateEnemyDisplay(display, enemy);
      }
    }

    // 相位
    const phaseLabel = ts.phase === 'player' ? '你的回合' : ts.phase === 'enemy' ? '敌方回合' : ts.phase === 'anim' ? '波次推进…' : '';
    this.phaseText.setText(phaseLabel);
  }

  private async playWaveTransition(ts: TurnState): Promise<void> {
    // 旧敌人淡出
    const oldSprites = [...this.enemyDisplays.values()].map(d => d.sprite);
    if (oldSprites.length > 0) {
      await this.tweenPromise({
        targets: oldSprites,
        alpha: 0, scale: 0, duration: 250,
      });
    }
    this.clearEnemyDisplays();
    this.rebuildEnemies(ts);

    // 新敌人淡入
    const newSprites = [...this.enemyDisplays.values()].map(d => d.sprite);
    for (const s of newSprites) { s.setAlpha(0).setScale(0); }
    if (newSprites.length > 0) {
      await this.tweenPromise({
        targets: newSprites,
        alpha: 1, duration: 300,
      });
      // 恢复缩放
      for (const [uid, display] of this.enemyDisplays) {
        const enemy = ts.enemies.find(e => e.uid === uid);
        display.sprite.setScale(enemy?.isBoss ? 1.5 : 1.0);
      }
    }
  }

  // ─── 动画 ─────────────────────────────────────────

  private async playLogEntry(entry: TurnLogEntry, ts: TurnState): Promise<void> {
    if (entry.defeated) {
      await this.playDefeat(entry, ts);
      return;
    }
    if (entry.action === 'dot') {
      await this.playDotDamage(entry, ts);
      return;
    }
    if (entry.actor === 'hero') {
      switch (entry.action) {
        case 'attack': await this.playHeroAttack(entry, ts); break;
        case 'skill': await this.playHeroSkill(entry, ts); break;
        case 'defend': await this.playHeroDefend(); break;
        case 'flee': await this.playHeroFlee(); break;
      }
    } else {
      switch (entry.action) {
        case 'attack': await this.playEnemyAttack(entry, ts); break;
        case 'skill': await this.playEnemySkill(entry, ts); break;
      }
    }
  }

  /** 获取动画目标精灵 */
  private getTargetSprite(entry: TurnLogEntry, ts: TurnState): Phaser.GameObjects.Text | Phaser.GameObjects.Image {
    if (entry.actor === 'hero') {
      // 英雄攻击敌人：找目标敌人精灵
      if (entry.targetUid) {
        return this.getEnemyDisplay(entry.targetUid)?.sprite ?? this.hero;
      }
      return this.hero;
    } else {
      // 敌人攻击英雄：英雄是目标
      return this.hero;
    }
  }

  /** 获取行动者精灵 */
  private getActorSprite(entry: TurnLogEntry, ts: TurnState): Phaser.GameObjects.Text | Phaser.GameObjects.Image {
    if (entry.actor === 'hero') {
      return this.hero;
    } else {
      // 敌人行动：找行动者精灵
      if (entry.targetUid) {
        return this.getEnemyDisplay(entry.targetUid)?.sprite ?? this.hero;
      }
      if (entry.enemyIndex != null && ts.enemies[entry.enemyIndex]) {
        return this.getEnemyDisplay(ts.enemies[entry.enemyIndex].uid)?.sprite ?? this.hero;
      }
      return this.hero;
    }
  }

  private async playDotDamage(entry: TurnLogEntry, ts: TurnState): Promise<void> {
    const isHero = entry.actor === 'hero';
    const targetObj = isHero ? this.hero : (this.getEnemyDisplay(entry.targetUid ?? '')?.sprite ?? this.hero);
    const colorMap: Record<string, { tint: number; text: string }> = {
      '流血': { tint: 0xff3333, text: '#ff3333' },
      '燃烧': { tint: 0xff6600, text: '#ff6600' },
      '毒素': { tint: 0x33cc33, text: '#33cc33' },
    };
    const style = colorMap[entry.skillName || ''] || { tint: 0xff0000, text: '#ff0000' };

    this.flashTint(targetObj, style.tint);
    this.shakeUnit(targetObj);
    if (entry.damage) {
      this.showDamageText(targetObj.x, targetObj.y - 40, `-${entry.damage}`, style.text, entry.damageType, false);
    }
    if (entry.skillName) {
      this.showFloatingText(targetObj.x, targetObj.y - 70, entry.skillName, style.text);
    }
    await this.delay(300);
  }

  private async playHeroAttack(entry: TurnLogEntry, ts: TurnState): Promise<void> {
    const targetSprite = this.getTargetSprite(entry, ts);
    const originX = this.hero.x;
    await this.tweenPromise({ targets: this.hero, x: originX + 30, duration: 100 });
    this.flashTint(targetSprite, 0xffffff);
    this.shakeUnit(targetSprite);
    if (entry.damage) this.showDamageText(targetSprite.x, targetSprite.y - 40, `-${entry.damage}`, entry.crit ? '#ff3333' : '#ff4444', entry.damageType, entry.crit);
    this.cameras.main.shake(80, 0.005);
    await this.tweenPromise({ targets: this.hero, x: originX, duration: 120 });
  }

  private async playHeroSkill(entry: TurnLogEntry, ts: TurnState): Promise<void> {
    const targetSprite = this.getTargetSprite(entry, ts);
    const skill = entry.skillId ? SKILL_MAP[entry.skillId] : null;

    // 如果是 AOE 技能，对所有存活敌人播放特效
    if (skill?.targeting === 'auto_all') {
      for (const enemy of ts.enemies.filter(e => e.alive)) {
        const disp = this.getEnemyDisplay(enemy.uid);
        if (disp) {
          this.showSkillEffect(disp.sprite.x, disp.sprite.y, skill?.effectName, entry.damageType);
          this.flashTint(disp.sprite, 0xffaa00);
          this.shakeUnit(disp.sprite);
        }
      }
    } else {
      this.showSkillEffect(targetSprite.x, targetSprite.y, skill?.effectName, entry.damageType);
    }

    const originX = this.hero.x;
    await this.tweenPromise({ targets: this.hero, x: originX + 30, duration: 100 });

    if (skill?.targeting !== 'auto_all') {
      this.flashTint(targetSprite, 0xffaa00);
      this.shakeUnit(targetSprite);
    }

    // 显示伤害
    if (entry.damage) {
      if (skill?.targeting === 'auto_all') {
        for (const enemy of ts.enemies.filter(e => e.alive)) {
          const disp = this.getEnemyDisplay(enemy.uid);
          if (disp) this.showDamageText(disp.sprite.x, disp.sprite.y - 40, `-${Math.floor(entry.damage / ts.enemies.filter(e => e.alive).length)}`, '#ff9900', entry.damageType, true);
        }
      } else {
        this.showDamageText(targetSprite.x, targetSprite.y - 40, `-${entry.damage}`, '#ff9900', entry.damageType, true);
      }
    }
    if (entry.skillName) this.showFloatingText(this.hero.x, this.hero.y - 80, entry.skillName, '#ffaa00');
    this.cameras.main.shake(120, 0.008);
    await this.tweenPromise({ targets: this.hero, x: originX, duration: 120 });
  }

  private async playHeroDefend(): Promise<void> {
    const shield = this.add.text(this.hero.x, this.hero.y - 30, '🛡️', { fontSize: '32px' }).setOrigin(0.5).setAlpha(0);
    await this.tweenPromise({ targets: shield, alpha: 1, duration: 150, yoyo: true });
    shield.destroy();
  }

  private async playHeroFlee(): Promise<void> {
    const smoke = this.add.text(this.hero.x, this.hero.y, '💨', { fontSize: '48px' }).setOrigin(0.5).setAlpha(0);
    await this.tweenPromise({ targets: [this.hero, smoke], alpha: 0, duration: 300 });
  }

  private async playEnemyAttack(entry: TurnLogEntry, ts: TurnState): Promise<void> {
    const actorSprite = this.getActorSprite(entry, ts);
    const originX = actorSprite.x;
    await this.tweenPromise({ targets: actorSprite, x: originX - 30, duration: 100 });
    this.flashTint(this.hero, 0xff0000);
    this.shakeUnit(this.hero);
    if (entry.damage) this.showDamageText(this.hero.x, this.hero.y - 40, `-${entry.damage}`, '#ff5555', entry.damageType, entry.crit);
    this.cameras.main.shake(80, 0.005);
    await this.tweenPromise({ targets: actorSprite, x: originX, duration: 120 });
  }

  private async playEnemySkill(entry: TurnLogEntry, ts: TurnState): Promise<void> {
    const actorSprite = this.getActorSprite(entry, ts);
    this.showSkillEffect(this.hero.x, this.hero.y, 'scratch_01.png', entry.damageType);
    const originX = actorSprite.x;
    await this.tweenPromise({ targets: actorSprite, x: originX - 30, duration: 100 });
    this.flashTint(this.hero, 0xff0000);
    this.shakeUnit(this.hero);
    if (entry.damage) this.showDamageText(this.hero.x, this.hero.y - 40, `-${entry.damage}`, '#ff3333', entry.damageType, true);
    if (entry.skillName) this.showFloatingText(actorSprite.x, actorSprite.y - 70, entry.skillName, '#ff0000');
    this.cameras.main.shake(140, 0.01);
    await this.tweenPromise({ targets: actorSprite, x: originX, duration: 120 });
  }

  private async playDefeat(entry: TurnLogEntry, ts: TurnState): Promise<void> {
    if (entry.actor === 'hero') {
      this.showFloatingText(this.hero.x, this.hero.y - 60, '击败!', '#00ff88');
      await this.tweenPromise({ targets: this.hero, alpha: 0, scale: 0, duration: 300,
        onComplete: () => { this.hero.setAlpha(1); this.hero.setScale(3); },
      });
    } else {
      // 敌人被击败
      const uid = entry.targetUid;
      if (uid) {
        const display = this.getEnemyDisplay(uid);
        if (display) {
          this.showFloatingText(display.sprite.x, display.sprite.y - 50, '击败!', '#00ff88');
          await this.tweenPromise({ targets: display.sprite, alpha: 0.2, scale: 0.5, duration: 300 });
        }
      } else {
        // 全部敌人击败（波次结束）
        for (const [, display] of this.enemyDisplays) {
          this.showFloatingText(display.sprite.x, display.sprite.y - 50, '击败!', '#00ff88');
        }
        await this.delay(300);
      }
    }
  }

  // ─── 回合处理 ─────────────────────────────────────────

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
      physical: '⚔️', magic: '🔮', fire: '🔥', ice: '❄️', lightning: '⚡',
      poison: '🧪', shadow: '💀', holy: '✨', bleed: '🩸', burn: '🔥',
    };
    const icon = damageType ? (iconMap[damageType] || '') : '';
    const dmg = this.add.text(x, y, text + icon, {
      fontSize: big ? '26px' : '18px', color, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25);

    dmg.setScale(0.5);
    this.tweens.add({
      targets: dmg, scale: big ? 1.4 : 1.1, y: y - 60, x: x + Phaser.Math.Between(-25, 25),
      duration: 150, ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: dmg, y: y - 100, alpha: 0, duration: 700, onComplete: () => dmg.destroy() });
      }
    });
  }

  private showFloatingText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, {
      fontSize: '22px', color, fontFamily: 'monospace', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setScale(0.5).setDepth(30);
    this.tweens.add({
      targets: label, y: y - 60, alpha: 1, scale: 1.2, duration: 300, yoyo: true, hold: 500,
      onComplete: () => label.destroy(),
    });
  }

  private showSkillEffect(x: number, y: number, effectName: string | undefined, damageType?: string): void {
    const tintColor = damageType ? (DAMAGE_TYPE_COLORS[damageType] ?? 0xffffff) : 0xffffff;
    if (effectName && this.textures.exists(`particle_${effectName}`)) {
      const particle = this.add.image(x, y, `particle_${effectName}`).setOrigin(0.5).setDepth(20);
      particle.setScale(0.3).setAlpha(0).setTint(tintColor);
      this.tweens.add({
        targets: particle, scale: 0.85, alpha: 1, duration: 200, yoyo: true, hold: 200,
        onComplete: () => particle.destroy()
      });
    } else {
      for (let i = 0; i < 6; i++) {
        const particle = this.add.circle(x, y, 2.5, tintColor).setAlpha(0.8).setDepth(20);
        const angle = (Math.PI * 2 * i) / 6;
        this.tweens.add({
          targets: particle, x: x + Math.cos(angle) * 25, y: y + Math.sin(angle) * 25,
          alpha: 0, scale: 0, duration: 400, onComplete: () => particle.destroy(),
        });
      }
    }
  }

  private shakeUnit(target: Phaser.GameObjects.Image | Phaser.GameObjects.Text): void {
    this.tweens.add({
      targets: target, x: { value: '+=10', duration: 40, yoyo: true, repeat: 3 },
    });
  }
}
