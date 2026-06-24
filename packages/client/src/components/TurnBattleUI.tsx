/**
 * 回合制战斗 DOM 覆盖层
 * 顶部 StepBar + 底部 ActionBar + 终局结算面板
 * 行动按钮 → store.playerAction；终局由 battleBridge 'battle-end' 触发
 */

import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { battleBridge, type BattleEndResult } from '../game/battleBridge';
import { SKILL_MAP, WARRIOR_SKILLS, WARRIOR_STARTER_SKILL_IDS } from '@shared/constants/skills';
import { LEVELS } from '@shared/constants/levels';
import { RARITY_COLORS, RARITY_NAMES } from '@shared/constants/equipment';
import { RESOURCE_META } from '@shared/constants/resources';
import { SkillType } from '@shared/types';
import type { Skill, Rarity, TurnLogEntry, Equipment } from '@shared/types';
import { EquipTooltip } from './EquipTooltip';

export function TurnBattleUI() {
  const turnState = useGameStore((s) => s.turnState);
  const hero = useGameStore((s) => s.hero);
  const currentLevelId = useGameStore((s) => s.currentLevelId);
  const battleReward = useGameStore((s) => s.battleReward);
  const playerAction = useGameStore((s) => s.playerAction);
  const claimBattleReward = useGameStore((s) => s.claimBattleReward);
  const endBattle = useGameStore((s) => s.endBattle);

  const [result, setResult] = useState<BattleEndResult | null>(null);

  useEffect(() => {
    const handler = (r: BattleEndResult) => setResult(r);
    battleBridge.on('battle-end', handler);
    return () => {
      battleBridge.off('battle-end', handler);
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

  const handleAction = (kind: 'attack' | 'defend' | 'flee' | 'skill', skillId?: string) => {
    if (!isPlayerTurn) return;
    playerAction(skillId ? { kind: 'skill', skillId } : { kind });
  };

  return (
    <div className="turn-battle-ui">
      <StepBar current={turnState.waveIndex} total={turnState.totalWaves} levelId={currentLevelId} />

      <BattleLog log={turnState.log} enemyName={turnState.enemyName} />

      <div className="turn-battle-ui__spacer" />

      <div className="action-bar">
        <div className="action-bar__main">
          <button
            className="action-btn action-btn--attack"
            disabled={!isPlayerTurn}
            onClick={() => handleAction('attack')}
          >
            <span className="action-btn__icon">⚔️</span>
            <span>攻击</span>
          </button>
          <button
            className="action-btn action-btn--defend"
            disabled={!isPlayerTurn}
            onClick={() => handleAction('defend')}
          >
            <span className="action-btn__icon">🛡️</span>
            <span>防御</span>
          </button>
          <button
            className="action-btn action-btn--flee"
            disabled={!isPlayerTurn}
            onClick={() => handleAction('flee')}
          >
            <span className="action-btn__icon">💨</span>
            <span>逃跑</span>
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
                className={`skill-btn ${insufficient ? 'skill-btn--disabled' : ''} ${
                  isChargeSkill && isCharging ? 'skill-btn--ready' : ''
                }`}
                disabled={!isPlayerTurn || insufficient}
                onClick={() => handleAction('skill', skill.id)}
                title={skill.description}
              >
                <span className="skill-btn__head">
                  <span className="skill-btn__icon">{skill.icon}</span>
                  <span className="skill-btn__name">{skill.name}</span>
                  {chargeLabel && (
                    <span className={`skill-btn__charge skill-btn__charge--${isCharging ? 'release' : 'charge'}`}>
                      {chargeLabel}
                    </span>
                  )}
                </span>
                <span className="skill-btn__desc">{skill.description}</span>
                <span className="skill-btn__cost">{skill.rageCost} 怒</span>
              </button>
            );
          })}
        </div>
      </div>

      {result && (
        <BattleResultPanel
          result={result}
          reward={battleReward}
          onClaim={claimBattleReward}
          onReturn={endBattle}
        />
      )}
    </div>
  );
}

function StepBar({ current, total, levelId }: { current: number; total: number; levelId: string | null }) {
  const progressPercent = total > 1 ? (current / (total - 1)) * 100 : 100;
  const level = LEVELS.find((l) => l.id === levelId);

  return (
    <div className="step-bar-container">
      {/* Progress background line */}
      <div className="step-bar-line">
        <div className="step-bar-line__fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Nodes list */}
      <div className="step-bar-nodes">
        {Array.from({ length: total }).map((_, i) => {
          const wave = level?.waves[i];
          const monster = wave?.monsters[0];

          let icon = '👾'; // Normal monster by default
          if (monster) {
            if (monster.isBoss) {
              icon = '👑';
            } else if (monster.tags.includes('elite') || monster.name.includes('精英')) {
              icon = '👹';
            }
          } else {
            // Fallback if level/wave is not loaded
            if (i === total - 1) icon = '👑';
          }

          const isCompleted = i < current;
          const isActive = i === current;

          let statusClass = '';
          if (isCompleted) statusClass = 'step-node--completed';
          else if (isActive) statusClass = 'step-node--active';
          else statusClass = 'step-node--pending';

          return (
            <div key={i} className={`step-node ${statusClass}`}>
              <div className="step-node__circle">
                <span className="step-node__icon">{icon}</span>
                {isCompleted && <span className="step-node__check">✓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EquipDropCell({ eq }: { eq: Equipment }) {
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number; showBelow: boolean } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const showBelow = rect.top < 280;
    
    setPosition({
      x: rect.left + rect.width / 2,
      y: showBelow ? rect.bottom + 8 : rect.top - 8,
      showBelow
    });
    setHovered(true);
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  return (
    <div
      className="equip-drop"
      style={{ borderColor: RARITY_COLORS[eq.rarity as Rarity] }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="equip-drop__name" style={{ color: RARITY_COLORS[eq.rarity as Rarity] }}>
        {eq.name}
      </span>
      <span className="equip-drop__rarity">{RARITY_NAMES[eq.rarity as Rarity]}</span>
      <EquipTooltip item={eq} visible={hovered} position={position || undefined} />
    </div>
  );
}

function BattleResultPanel({
  result,
  reward,
  onClaim,
  onReturn,
}: {
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
              {reward.equipment.map((eq) => (
                <EquipDropCell key={eq.id} eq={eq} />
              ))}
            </div>
          </div>
        )}
        {reward.isFirstClear && <div className="battle-result__firstclear">★ 首次通关额外奖励已包含 ★</div>}
        <button className="battle-result__btn battle-result__btn--primary" onClick={onClaim}>
          领取奖励
        </button>
      </div>
    );
  }

  return (
    <div className={`battle-result ${result === 'lose' ? 'battle-result--lose' : 'battle-result--flee'}`}>
      <div className="battle-result__title">
        {result === 'lose' ? '💀 战斗失败' : '💨 已逃跑'}
      </div>
      <div className="battle-result__hint">
        {result === 'lose' ? '再接再厉，提升实力后再来挑战' : '没有获得奖励'}
      </div>
      <button className="battle-result__btn" onClick={onReturn}>
        返回地图
      </button>
    </div>
  );
}

function formatLogEntry(entry: TurnLogEntry, enemyName: string): string {
  const actorName = entry.actor === 'hero' ? '你' : enemyName;
  if (entry.defeated) {
    return entry.actor === 'enemy' ? `击败 ${enemyName}!` : '你被击败了…';
  }
  switch (entry.action) {
    case 'attack':
      return `${actorName}攻击 → ${entry.damage} 伤害${entry.crit ? ' (暴击!)' : ''}`;
    case 'skill':
      return `${actorName}施放${entry.skillName ?? '技能'} → ${entry.damage ?? 0} 伤害${entry.crit ? ' (暴击!)' : ''}`;
    case 'defend':
      return `${actorName}进入防御姿态${entry.rageGain ? ` (+${entry.rageGain} 怒)` : ''}`;
    case 'flee':
      return `${actorName}尝试逃跑…`;
    default:
      return '';
  }
}

function BattleLog({ log, enemyName }: { log: TurnLogEntry[]; enemyName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  return (
    <div className="battle-log" ref={ref}>
      {log.map((entry, i) => (
        <div key={i} className={`battle-log__entry battle-log__entry--${entry.actor}`}>
          {formatLogEntry(entry, enemyName)}
        </div>
      ))}
    </div>
  );
}


