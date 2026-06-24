/**
 * 冒险地图 - 区域标签 + 关卡网格
 * 点击关卡节点开始战斗
 */

import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { REGIONS, isRegionUnlocked, isLevelUnlocked } from '@shared/constants/regions';

interface AdventureMapProps {
  onStartLevel: (levelId: string) => void;
}

export function AdventureMap({ onStartLevel }: AdventureMapProps) {
  const levelProgress = useGameStore((s) => s.levelProgress);
  const [activeRegionIdx, setActiveRegionIdx] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  const region = REGIONS[activeRegionIdx];

  return (
    <div className="adventure-map">
      <div className="adventure-map__header">
        <span className="adventure-map__title">🗺️ 冒险地图</span>
        <span className="adventure-map__hint">点击关卡节点开始冒险</span>
      </div>

      {/* 区域标签 */}
      <div className="region-tabs">
        {REGIONS.map((r, i) => {
          const unlocked = isRegionUnlocked(r.id, levelProgress);
          return (
            <button
              key={r.id}
              className={`region-tab ${i === activeRegionIdx ? 'region-tab--active' : ''} ${!unlocked ? 'region-tab--locked' : ''}`}
              onClick={() => unlocked && setActiveRegionIdx(i)}
              disabled={!unlocked}
            >
              {!unlocked && <span className="region-tab__lock">🔒</span>}
              <span className="region-tab__name">{r.name}</span>
            </button>
          );
        })}
      </div>

      {/* 关卡网格 */}
      <div className="level-grid">
        {region.levels.map((level) => {
          const unlocked = isLevelUnlocked(level.id, levelProgress);
          const prog = levelProgress[level.id];
          const cleared = prog?.cleared ?? false;
          const isHover = hovered === level.id;

          return (
            <div
              key={level.id}
              className={`level-cell ${cleared ? 'level-cell--cleared' : ''} ${!unlocked ? 'level-cell--locked' : ''} ${isHover && unlocked ? 'level-cell--hover' : ''}`}
              onMouseEnter={() => setHovered(level.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => unlocked && onStartLevel(level.id)}
            >
              <div className="level-cell__id">{level.name}</div>
              <div className="level-cell__status">
                {cleared ? '✓' : !unlocked ? '🔒' : '●'}
              </div>

              {isHover && unlocked && (
                <div className="level-tooltip">
                  <div className="level-tooltip__title">{level.name}</div>
                  <div className="level-tooltip__desc">{region.name}</div>
                  <div className="level-tooltip__meta">
                    <div>🎯 推荐 Lv.{level.recommendLevel}</div>
                    <div>⚔️ 波次：{level.waves.length}</div>
                    <div>💎 首通：{level.firstClearReward.gems ?? 0} 钻 · 🎖️ {level.firstClearReward.badge ?? 0} 勋章</div>
                  </div>
                  {cleared && <div className="level-tooltip__cleared">已通关</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 区域描述 */}
      <div className="region-desc">
        <div className="region-desc__name">{region.name}</div>
        <div className="region-desc__text">{region.desc}</div>
      </div>
    </div>
  );
}
