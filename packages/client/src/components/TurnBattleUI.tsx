/**
 * 回合制战斗 DOM 覆盖层
 * 左侧友方面板 + 右侧敌方面板 + 波次进度 + 底部 ActionBar + 终局结算
 *
 * 目标选择：点击精灵模型（Phaser）或点击面板头像（DOM）均可
 * 通信：battleBridge target-request / target-selected
 */

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { battleBridge, type BattleEndResult } from '../game/battleBridge';
import { WARRIOR_SKILLS, WARRIOR_STARTER_SKILL_IDS } from '@shared/constants/skills';
import { RARITY_COLORS, RARITY_NAMES } from '@shared/constants/equipment';
import { RESOURCE_META } from '@shared/constants/resources';
import { SkillType } from '@shared/types';
import type { Skill, Rarity, TurnLogEntry, Equipment, EnemyCombatState, TurnState } from '@shared/types';
import { EquipTooltip } from './EquipTooltip';

export function TurnBattleUI() {
  const turnState = useGameStore((s) => s.turnState);
  const hero = useGameStore((s) => s.hero);
  const battleReward = useGameStore((s) => s.battleReward);
  const playerAction = useGameStore((s) => s.playerAction);
  const claimBattleReward = useGameStore((s) => s.claimBattleReward);
  const endBattle = useGameStore((s) => s.endBattle);

  const [result, setResult] = useState<BattleEndResult | null>(null);
  const [targetingMode, setTargetingMode] = useState(false);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);
  const [autoTarget, setAutoTarget] = useState(true);
  const [logCollapsed, setLogCollapsed] = useState(false);

  // 监听 battleBridge 事件
  useEffect(() => {
    const onEnd = (r: BattleEndResult) => setResult(r);
    battleBridge.on('battle-end', onEnd);

    // Phaser 精灵点击选目标 → 执行行动
    const onTargetSelected = (payload: { uid: string }) => {
      executeWithTarget(payload.uid);
    };
    battleBridge.on('target-selected', onTargetSelected);

    return () => {
      battleBridge.off('battle-end', onEnd);
      battleBridge.off('target-selected', onTargetSelected);
      setResult(null);
    };
  }, []);

  if (!turnState || !hero) return null;

  const isPlayerTurn = turnState.phase === 'player';
  let activeSkills: Skill[] = WARRIOR_SKILLS.filter(
    (s) => s.type === SkillType.Active && (hero.skills || []).some((hs) => hs.id === s.id),
  );
  if (activeSkills.length === 0) {
    activeSkills = WARRIOR_SKILLS.filter(
      (s) => s.type === SkillType.Active && WARRIOR_STARTER_SKILL_IDS.includes(s.id)
    );
  }

  const aliveEnemies = turnState.enemies.filter(e => e.alive);

  // ── 行动处理 ──────────────────────────────

  const executeWithTarget = (uid: string) => {
    if (pendingSkillId === null) {
      // 普攻
      playerAction({ kind: 'attack', targetUid: uid });
    } else {
      // 技能
      playerAction({ kind: 'skill', skillId: pendingSkillId, targetUid: uid });
    }
    exitTargetingMode();
  };

  const enterTargetingMode = (skillId: string | null) => {
    setTargetingMode(true);
    setPendingSkillId(skillId);
    // 通知 Phaser 场景进入选目标模式
    battleBridge.emit('target-request', { pendingSkillId: skillId });
  };

  const exitTargetingMode = () => {
    setTargetingMode(false);
    setPendingSkillId(null);
    battleBridge.emit('target-cancel', {});
  };

  const handleAction = (kind: 'attack' | 'defend' | 'flee' | 'skill', skill?: Skill) => {
    if (!isPlayerTurn) return;

    if (kind === 'attack') {
      if (autoTarget && aliveEnemies.length > 0) {
        playerAction({ kind: 'attack', targetUid: aliveEnemies[0].uid });
      } else if (aliveEnemies.length === 1) {
        playerAction({ kind: 'attack', targetUid: aliveEnemies[0].uid });
      } else {
        enterTargetingMode(null); // null = 普攻
      }
      return;
    }

    if (kind === 'skill' && skill) {
      const targeting = skill.targeting ?? 'single';

      if (targeting === 'self' || targeting === 'auto_all') {
        playerAction({ kind: 'skill', skillId: skill.id });
        return;
      }

      if (autoTarget || aliveEnemies.length === 1) {
        const target = aliveEnemies[0];
        if (targeting === 'single' || targeting === 'chain') {
          playerAction({ kind: 'skill', skillId: skill.id, targetUid: target.uid });
        } else if (targeting === 'multi') {
          const count = skill.targetCount ?? 1;
          const targets = aliveEnemies.slice(0, count).map(e => e.uid);
          playerAction({ kind: 'skill', skillId: skill.id, targetUids: targets });
        }
        return;
      }

      // 进入手动选目标模式
      enterTargetingMode(skill.id);
      return;
    }

    if (kind === 'defend') {
      playerAction({ kind: 'defend' });
      return;
    }

    if (kind === 'flee') {
      playerAction({ kind: 'flee' });
      return;
    }
  };

  // 点击面板上的敌人头像选目标
  const handlePanelEnemyClick = (uid: string) => {
    if (!targetingMode) return;
    executeWithTarget(uid);
  };

  return (
    <div className="turn-battle-ui">
      <StepBar current={turnState.waveIndex} total={turnState.totalWaves} />

      {/* 左侧友方面板 */}
      <div className="party-panel party-panel--left">
        <div className="party-panel__title">友方</div>
        <UnitFrame
          icon="⚔️"
          name={hero.name}
          level={hero.level}
          hp={turnState.heroHp}
          maxHp={turnState.heroMaxHp}
          resource={turnState.heroRage}
          maxResource={turnState.heroMaxRage}
          resourceName="怒"
          buffs={turnState.heroBuffs}
          alive={turnState.heroHp > 0}
          isPlayer={true}
        />
      </div>

      {/* 右侧敌方面板 */}
      <div className="party-panel party-panel--right">
        <div className="party-panel__title">敌方</div>
        {turnState.enemies.map((enemy) => (
          <UnitFrame
            key={enemy.uid}
            icon={enemy.icon}
            name={enemy.name}
            level={enemy.level}
            hp={enemy.hp}
            maxHp={enemy.maxHp}
            buffs={enemy.buffs}
            alive={enemy.alive}
            isBoss={enemy.isBoss}
            isElite={enemy.isElite}
            targetingMode={targetingMode}
            onClick={() => handlePanelEnemyClick(enemy.uid)}
          />
        ))}
      </div>

      {/* 目标选择提示 */}
      {targetingMode && (
        <div className="targeting-bar">
          <span className="targeting-bar__hint">
            {pendingSkillId ? '点击敌人模型或头像选择目标' : '点击敌人模型或头像进行攻击'}
          </span>
          <button className="targeting-bar__cancel" onClick={exitTargetingMode}>取消</button>
        </div>
      )}

      <div className="turn-battle-ui__spacer" />

      {/* 辅助行：开关（左）+ 日志（右） */}
      <div className="aux-bar">
        <div
          className={`switch-toggle ${autoTarget ? 'switch-toggle--on' : ''}`}
          onClick={() => setAutoTarget(!autoTarget)}
          role="switch"
          aria-checked={autoTarget}
        >
          <span className="switch-toggle__track">
            <span className="switch-toggle__thumb" />
          </span>
          <span className="switch-toggle__label">自动选目标</span>
        </div>

        <div className="battle-log-anchor">
          {!logCollapsed && (
            <div className="battle-log-popup">
              <BattleLog log={turnState.log} enemies={turnState.enemies} />
            </div>
          )}
          <div className="battle-log-header" onClick={() => setLogCollapsed(!logCollapsed)}>
            <span className="battle-log-header__title">📝 战斗日志</span>
            <span className="battle-log-header__toggle">{logCollapsed ? '▲' : '▼'}</span>
          </div>
        </div>
      </div>

      {/* 行动栏：铺满底部 */}
      <div className="action-bar">
        <div className="action-bar__main">
          <button className="action-btn action-btn--attack" disabled={!isPlayerTurn} onClick={() => handleAction('attack')}>
            <span className="action-btn__icon">⚔️</span><span>攻击</span>
          </button>
          <button className="action-btn action-btn--defend" disabled={!isPlayerTurn} onClick={() => handleAction('defend')}>
            <span className="action-btn__icon">🛡️</span><span>防御</span>
          </button>
          <button className="action-btn action-btn--flee" disabled={!isPlayerTurn} onClick={() => handleAction('flee')}>
            <span className="action-btn__icon">💨</span><span>逃跑</span>
          </button>
        </div>
        <div className="action-bar__skills">
          {activeSkills.map((skill) => {
            const insufficient = turnState.heroRage < skill.rageCost;
            const isChargeSkill = skill.chargeSkill === true;
            const isCharging = turnState.heroBuffs.some((b) => b.kind === 'charging');
            const chargeLabel = isChargeSkill ? (isCharging ? '释放' : '蓄力') : null;
            return (
              <button
                key={skill.id}
                className={`skill-btn ${insufficient ? 'skill-btn--disabled' : ''} ${isChargeSkill && isCharging ? 'skill-btn--ready' : ''}`}
                disabled={!isPlayerTurn || insufficient}
                onClick={() => handleAction('skill', skill)}
                title={skill.description}
              >
                <span className="skill-btn__head">
                  <span className="skill-btn__icon">{skill.icon}</span>
                  <span className="skill-btn__name">{skill.name}</span>
                  {chargeLabel && <span className={`skill-btn__charge skill-btn__charge--${isCharging ? 'release' : 'charge'}`}>{chargeLabel}</span>}
                </span>
                <span className="skill-btn__desc">{skill.description}</span>
                <span className="skill-btn__cost">{skill.rageCost} 怒</span>
              </button>
            );
          })}
        </div>
      </div>

      {result && (
        <BattleResultPanel result={result} reward={battleReward} onClaim={claimBattleReward} onReturn={endBattle} />
      )}
    </div>
  );
}

// ─── MMO 风格单位面板 ─────────────────────────────────

interface UnitFrameProps {
  icon: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  resource?: number;
  maxResource?: number;
  resourceName?: string;
  buffs: any[];
  alive: boolean;
  isPlayer?: boolean;
  isBoss?: boolean;
  isElite?: boolean;
  targetingMode?: boolean;
  onClick?: () => void;
}

function UnitFrame({ icon, name, level, hp, maxHp, resource, maxResource, resourceName, buffs, alive, isPlayer, isBoss, isElite, targetingMode, onClick }: UnitFrameProps) {
  const hpPercent = Math.max(0, hp / maxHp * 100);
  const resourcePercent = maxResource ? Math.min(100, (resource ?? 0) / maxResource * 100) : 0;

  return (
    <div
      className={`unit-frame ${!alive ? 'unit-frame--dead' : ''} ${isBoss ? 'unit-frame--boss' : ''} ${isElite ? 'unit-frame--elite' : ''} ${targetingMode && !isPlayer && alive ? 'unit-frame--targetable' : ''}`}
      onClick={targetingMode && !isPlayer && alive ? onClick : undefined}
    >
      <div className="unit-frame__header">
        <span className="unit-frame__icon">{icon}</span>
        <div className="unit-frame__info">
          <span className="unit-frame__name">{name}</span>
          <span className="unit-frame__level">Lv.{level}</span>
        </div>
      </div>
      <div className="unit-frame__bars">
        <div className="unit-frame__bar unit-frame__bar--hp">
          <div className="unit-frame__bar-fill" style={{ width: `${hpPercent}%` }} />
          <span className="unit-frame__bar-text">{Math.max(0, hp)} / {maxHp}</span>
        </div>
        {resource !== undefined && maxResource !== undefined && (
          <div className="unit-frame__bar unit-frame__bar--resource">
            <div className="unit-frame__bar-fill unit-frame__bar-fill--resource" style={{ width: `${resourcePercent}%` }} />
            <span className="unit-frame__bar-text">{resource} / {maxResource} {resourceName}</span>
          </div>
        )}
      </div>
      {buffs.length > 0 && (
        <div className="unit-frame__buffs">
          {buffs.map((b, i) => (
            <span key={i} className="unit-frame__buff">{b.kind}{b.remainingTurns}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 波次进度 ─────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  const progressPercent = total > 1 ? (current / (total - 1)) * 100 : 100;
  return (
    <div className="step-bar-container">
      <div className="step-bar-line">
        <div className="step-bar-line__fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="step-bar-nodes">
        {Array.from({ length: total }).map((_, i) => {
          const isCompleted = i < current;
          const isActive = i === current;
          let statusClass = isCompleted ? 'step-node--completed' : isActive ? 'step-node--active' : 'step-node--pending';
          return (
            <div key={i} className={`step-node ${statusClass}`}>
              <div className="step-node__circle">
                <span className="step-node__icon">{i === total - 1 ? '👑' : '⚔️'}</span>
                {isCompleted && <span className="step-node__check">✓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 战斗日志 ─────────────────────────────────────────

function formatLogEntry(entry: TurnLogEntry, enemies: EnemyCombatState[]): string {
  let actorName = '你';
  if (entry.actor === 'enemy') {
    if (entry.targetUid) {
      actorName = enemies.find(e => e.uid === entry.targetUid)?.name ?? '敌人';
    } else if (entry.enemyIndex != null) {
      actorName = enemies[entry.enemyIndex]?.name ?? '敌人';
    } else {
      actorName = enemies[0]?.name ?? '敌人';
    }
  }
  if (entry.defeated) return entry.actor === 'enemy' ? `${actorName}被击败!` : '你被击败了…';
  switch (entry.action) {
    case 'attack': return `${actorName}攻击 → ${entry.damage} 伤害${entry.crit ? ' (暴击!)' : ''}`;
    case 'skill': return `${actorName}施放${entry.skillName ?? '技能'} → ${entry.damage ?? 0} 伤害${entry.crit ? ' (暴击!)' : ''}`;
    case 'defend': return `${actorName}${entry.skillName ?? '进入防御姿态'}${entry.rageGain ? ` (+${entry.rageGain} 怒)` : ''}`;
    case 'flee': return `${actorName}尝试逃跑…`;
    case 'dot': return `${actorName}受到${entry.skillName ?? '持续伤害'} → ${entry.damage} 伤害`;
    default: return '';
  }
}

function BattleLog({ log, enemies }: { log: TurnLogEntry[]; enemies: EnemyCombatState[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  return (
    <div className="battle-log" ref={ref}>
      {log.map((entry, i) => (
        <div key={i} className={`battle-log__entry battle-log__entry--${entry.actor}`}>
          {formatLogEntry(entry, enemies)}
        </div>
      ))}
    </div>
  );
}

// ─── 结算面板 ─────────────────────────────────────────

function EquipDropCell({ eq }: { eq: Equipment }) {
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number; showBelow: boolean } | null>(null);
  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({ x: rect.left + rect.width / 2, y: rect.top < 280 ? rect.bottom + 8 : rect.top - 8, showBelow: rect.top < 280 });
    setHovered(true);
  };
  return (
    <div className="equip-drop" style={{ borderColor: RARITY_COLORS[eq.rarity as Rarity] }} onMouseEnter={handleMouseEnter} onMouseLeave={() => setHovered(false)}>
      <span className="equip-drop__name" style={{ color: RARITY_COLORS[eq.rarity as Rarity] }}>{eq.name}</span>
      <span className="equip-drop__rarity">{RARITY_NAMES[eq.rarity as Rarity]}</span>
      <EquipTooltip item={eq} visible={hovered} position={position || undefined} />
    </div>
  );
}

function BattleResultPanel({ result, reward, onClaim, onReturn }: {
  result: BattleEndResult;
  reward: ReturnType<typeof useGameStore.getState>['battleReward'];
  onClaim: () => void;
  onReturn: () => void;
}) {
  if (result === 'win' && reward) {
    return (
      <div className="battle-result battle-result--win">
        <div className="battle-result__title">🎉 战斗胜利</div>
        <div className="battle-result__section">
          <div className="battle-result__subtitle">奖励</div>
          <div className="battle-result__rewards">
            {(['gold', 'exp', 'gems', 'badge'] as const).map((k) => {
              const v = reward.resources[k] ?? 0;
              if (v <= 0) return null;
              return (
                <div key={k} className="reward-item">
                  <span className={`reward-item__icon ${RESOURCE_META[k].iconClass}`}></span>
                  <span className="reward-item__name">{RESOURCE_META[k].name}</span>
                  <span className="reward-item__value">+{v}</span>
                </div>
              );
            })}
          </div>
        </div>
        {reward.equipment.length > 0 && (
          <div className="battle-result__section">
            <div className="battle-result__subtitle">装备掉落</div>
            <div className="battle-result__equipment">
              {reward.equipment.map((eq) => <EquipDropCell key={eq.id} eq={eq} />)}
            </div>
          </div>
        )}
        {reward.isFirstClear && <div className="battle-result__firstclear">★ 首次通关额外奖励已包含 ★</div>}
        <button className="battle-result__btn battle-result__btn--primary" onClick={onClaim}>领取奖励</button>
      </div>
    );
  }
  return (
    <div className={`battle-result ${result === 'lose' ? 'battle-result--lose' : 'battle-result--flee'}`}>
      <div className="battle-result__title">{result === 'lose' ? '💀 战斗失败' : '💨 已逃跑'}</div>
      <div className="battle-result__hint">{result === 'lose' ? '再接再厉，提升实力后再来挑战' : '没有获得奖励'}</div>
      <button className="battle-result__btn" onClick={onReturn}>返回地图</button>
    </div>
  );
}
