/**
 * 天赋树 - 纵向 3 级开花式布局
 * 顶部「基础技能」标签 → 第1级 3 主动技能（各 3 扩展）
 *   ↓ 投 5 点解锁（进度条连线）
 * 第2级 核心技能（各 3 扩展）
 *   ↓ 投 10 点解锁
 * 第3级 防御技能（各 3 扩展）
 */

import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { WARRIOR_TALENT_TREE, TALENT_NODE_MAP } from '@shared/constants/talents';
import { totalSpent } from '@shared/logic/turnBasedCombat';
import type { TalentNode, LearnedTalents } from '@shared/types';

const TIER_THEME = [
  { color: '#1eff00', glow: 'rgba(30,255,0,0.5)' },   // 基础 绿
  { color: '#a335ee', glow: 'rgba(163,53,238,0.5)' },  // 核心 紫
  { color: '#0070dd', glow: 'rgba(0,112,221,0.5)' },   // 防御 蓝
];

function nodeRank(learned: LearnedTalents, id: string): number {
  return learned[id] || 0;
}

function prereqMet(learned: LearnedTalents, node: TalentNode): boolean {
  return (node.requires || []).every(r => nodeRank(learned, r) > 0);
}

function tierUnlocked(learned: LearnedTalents, tier: number): boolean {
  const t = WARRIOR_TALENT_TREE.tiers.find(t => t.tier === tier);
  if (!t) return true;
  return totalSpent(learned) >= t.unlockAt;
}

function canLearn(
  learned: LearnedTalents,
  talentPoints: number,
  node: TalentNode,
): boolean {
  if (node.maxRank <= 0) return false;
  if (talentPoints <= 0) return false;
  if (nodeRank(learned, node.id) >= node.maxRank) return false;
  if (!prereqMet(learned, node)) return false;
  if (!tierUnlocked(learned, node.tier)) return false;
  // 互斥组：同组已有节点被学习则不可再学
  if (node.exclusiveGroup) {
    const groupLearned = WARRIOR_TALENT_TREE.nodes.some(
      (n) =>
        n.id !== node.id &&
        n.exclusiveGroup === node.exclusiveGroup &&
        (learned[n.id] || 0) > 0,
    );
    if (groupLearned) return false;
  }
  return true;
}

// 判断节点是否因互斥组已被占用而锁定
function isExcluded(
  learned: LearnedTalents,
  node: TalentNode,
): boolean {
  if (!node.exclusiveGroup) return false;
  if ((learned[node.id] || 0) > 0) return false; // 自己已学不算被排除
  return WARRIOR_TALENT_TREE.nodes.some(
    (n) =>
      n.id !== node.id &&
      n.exclusiveGroup === node.exclusiveGroup &&
      (learned[n.id] || 0) > 0,
  );
}

const TalentNodeView: React.FC<{
  node: TalentNode;
  rank: number;
  learned: boolean;
  available: boolean;
  excluded?: boolean;
  tierColor: string;
  tierGlow: string;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}> = ({ node, rank, learned, available, excluded, tierColor, tierGlow, onClick, onContextMenu }) => {
  const cls = [
    'talent-node-v',
    learned ? 'is-learned' : '',
    available ? 'is-available' : '',
    !learned && !available && !excluded ? 'is-locked' : '',
    excluded ? 'is-excluded' : '',
    node.kind === 'label' ? 'is-label' : '',
    node.kind === 'skill' ? 'is-skill' : '',
    node.kind === 'upgrade' ? 'is-upgrade' : '',
  ].filter(Boolean).join(' ');

  const style: React.CSSProperties = learned
    ? { borderColor: tierColor, boxShadow: `0 0 16px ${tierGlow}` }
    : available
      ? { borderColor: tierColor }
      : {};

  return (
    <button
      type="button"
      className={cls}
      style={style}
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={node.kind === 'label' || (!learned && !available)}
      title={excluded ? '互斥：已选择同组其他强化' : node.desc}
    >
      <span className="talent-node-v__icon">{node.icon}</span>
      <span className="talent-node-v__name">{node.name}</span>
      <span className="talent-node-v__desc">{node.desc}</span>
      {node.maxRank > 0 && (
        <span className="talent-node-v__rank">{rank}/{node.maxRank}</span>
      )}
    </button>
  );
};

const TierSection: React.FC<{
  tier: number;
  learned: LearnedTalents;
  talentPoints: number;
  onLearn: (id: string) => void;
  onRefund: (id: string) => void;
}> = ({ tier, learned, talentPoints, onLearn, onRefund }) => {
  const t = WARRIOR_TALENT_TREE.tiers.find(t => t.tier === tier);
  if (!t) return null;
  const theme = TIER_THEME[tier - 1];
  const skillNodes = t.skillNodeIds.map(id => TALENT_NODE_MAP[id]);
  const upgradeNodes = t.upgradeNodeIds.map(id => TALENT_NODE_MAP[id]);

  // 按 parentSkillId 分组 upgrade
  const upgradesBySkill: Record<string, TalentNode[]> = {};
  for (const upg of upgradeNodes) {
    const key = upg.parentSkillId || '';
    (upgradesBySkill[key] ||= []).push(upg);
  }

  return (
    <div className="talent-tier-v">
      <div className="talent-tier-v__label" style={{ color: theme.color }}>
        {t.label}
      </div>
      <div className="talent-tier-v__cols">
        {skillNodes.map(skill => {
          const upgs = upgradesBySkill[skill.skillId || ''] || [];
          return (
            <div className="talent-col-v" key={skill.id}>
              <TalentNodeView
                node={skill}
                rank={nodeRank(learned, skill.id)}
                learned={nodeRank(learned, skill.id) > 0}
                available={canLearn(learned, talentPoints, skill)}
                tierColor={theme.color}
                tierGlow={theme.glow}
                onClick={() => onLearn(skill.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onRefund(skill.id);
                }}
              />
              <div className="talent-col-v__link" style={{ background: theme.color }} />
              {upgs.map(upg => {
                const upgLearned = nodeRank(learned, upg.id) > 0;
                const upgExcluded = !upgLearned && isExcluded(learned, upg);
                return (
                  <TalentNodeView
                    key={upg.id}
                    node={upg}
                    rank={nodeRank(learned, upg.id)}
                    learned={upgLearned}
                    available={canLearn(learned, talentPoints, upg)}
                    excluded={upgExcluded}
                    tierColor={theme.color}
                    tierGlow={theme.glow}
                    onClick={() => onLearn(upg.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onRefund(upg.id);
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProgressBar: React.FC<{
  unlockAt: number;
  current: number;
}> = ({ unlockAt, current }) => {
  const ratio = Math.min(1, current / unlockAt);
  const ready = current >= unlockAt;
  return (
    <div className={`talent-progress-v${ready ? ' is-ready' : ''}`}>
      <div className="talent-progress-v__bar" style={{ width: `${ratio * 100}%` }} />
      <span className="talent-progress-v__text">
        {ready ? '已解锁' : `${current}/${unlockAt}`}
      </span>
    </div>
  );
};

export const TalentPanel: React.FC = () => {
  const hero = useGameStore(s => s.hero);
  const learnTalentNode = useGameStore(s => s.learnTalentNode);
  const refundTalentNode = useGameStore(s => s.refundTalentNode);
  const resetAllTalents = useGameStore(s => s.resetAllTalents);

  if (!hero) return <div className="talent-tree-v">加载中...</div>;

  const learned = hero.learnedTalents;
  const spent = totalSpent(learned);
  const labelNode = WARRIOR_TALENT_TREE.label;

  return (
    <div className="talent-tree-v">
      <div className="talent-tree-v__header">
        <h2>天赋</h2>
        <div className="talent-tree-v__points">
          可用点数: <strong>{hero.talentPoints}</strong>
        </div>
        <button type="button" className="talent-tree-v__reset" onClick={resetAllTalents}>
          全部重置
        </button>
      </div>

      <div className="talent-tree-v__content">
        {/* 顶部标签节点 */}
        <div className="talent-tree-v__root">
          <TalentNodeView
            node={labelNode}
            rank={0}
            learned={true}
            available={false}
            tierColor={TIER_THEME[0].color}
            tierGlow={TIER_THEME[0].glow}
            onClick={() => {}}
          />
        </div>

        <TierSection tier={1} learned={learned} talentPoints={hero.talentPoints} onLearn={learnTalentNode} onRefund={refundTalentNode} />

        <ProgressBar unlockAt={5} current={spent} />

        <TierSection tier={2} learned={learned} talentPoints={hero.talentPoints} onLearn={learnTalentNode} onRefund={refundTalentNode} />

        <ProgressBar unlockAt={10} current={spent} />

        <TierSection tier={3} learned={learned} talentPoints={hero.talentPoints} onLearn={learnTalentNode} onRefund={refundTalentNode} />
      </div>
    </div>
  );
};
