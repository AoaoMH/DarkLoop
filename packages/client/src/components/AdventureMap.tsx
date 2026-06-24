/**
 * 冒险地图 - 暗黑风卷轴地图，3 关卡节点沿蜿蜒路径排列
 * hover 显示信息浮窗（纯展示），点击节点直接开始战斗
 */

import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { LEVELS } from '@shared/constants/levels';

interface AdventureMapProps {
  onStartLevel: (levelId: string) => void;
}

// 节点坐标（百分比，相对于地图画布）
const NODE_POS: { id: string; x: number; y: number }[] = [
  { id: 'lv1_slime_plains', x: 18, y: 72 },
  { id: 'lv2_skeleton_graveyard', x: 50, y: 42 },
  { id: 'lv3_demon_lair', x: 82, y: 18 },
];

export function AdventureMap({ onStartLevel }: AdventureMapProps) {
  const levelProgress = useGameStore((s) => s.levelProgress);
  const [hovered, setHovered] = useState<string | null>(null);

  const posOf = (id: string) => NODE_POS.find(n => n.id === id)!;

  // 构建 SVG 蜿蜒路径
  const pathD = NODE_POS.reduce((acc, node, i) => {
    if (i === 0) return `M ${node.x} ${node.y}`;
    const prev = NODE_POS[i - 1];
    const cx = (prev.x + node.x) / 2;
    const cy = (prev.y + node.y) / 2 - 8;
    return `${acc} Q ${cx} ${cy} ${node.x} ${node.y}`;
  }, '');

  return (
    <div className="adventure-map">
      <div className="adventure-map__header">
        <span className="adventure-map__title">🗺️ 冒险地图</span>
        <span className="adventure-map__hint">点击关卡节点开始冒险</span>
      </div>

      <div className="adventure-map__canvas">
        <svg className="adventure-map__path" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255, 184, 77, 0.35)"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {LEVELS.map((level) => {
          const pos = posOf(level.id);
          const prog = levelProgress[level.id];
          const cleared = prog?.cleared ?? false;
          const isHover = hovered === level.id;
          return (
            <div
              key={level.id}
              className={`level-node level-node--diff-${level.difficulty} ${cleared ? 'level-node--cleared' : ''} ${isHover ? 'level-node--hover' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onMouseEnter={() => setHovered(level.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onStartLevel(level.id)}
            >
              <div className="level-node__marker">
                <div className="level-node__icon">{level.waves[level.waves.length - 1].monsters[0].icon}</div>
                {cleared && <div className="level-node__check">✓</div>}
              </div>
              <div className="level-node__label">{level.name}</div>
              <div className="level-node__stars">{'★'.repeat(level.difficulty)}</div>

              {isHover && (
                <div className={`level-hover ${pos.x > 60 ? 'level-hover--left' : 'level-hover--right'}`}>
                  <div className="level-hover__title">{level.name}</div>
                  <div className="level-hover__desc">{level.desc}</div>
                  <div className="level-hover__meta">
                    <div>👹 怪物等级：{level.waves[0].monsters[0].level} ~ {level.waves[level.waves.length - 1].monsters[0].level}</div>
                    <div>⚔️ 波次：{level.waves.length}（3 小怪 + 1 Boss）</div>
                    <div>🎯 推荐 Lv.{level.recommendLevel}</div>
                    <div>💎 首通：{level.firstClearReward.gems ?? 0} 钻 · 🎖️ {level.firstClearReward.badge ?? 0} 勋章</div>
                  </div>
                  <div className="level-hover__cta">▶ 点击节点进入战斗</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
