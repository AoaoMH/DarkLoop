/**
 * 底部资源栏 - 显示4种资源：金币/经验/钻石/冒险勋章
 */

import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { RESOURCE_META } from '@shared/constants/resources';
import { ResourceKind } from '@shared/types';

const ORDER: ResourceKind[] = [ResourceKind.Gold, ResourceKind.Exp, ResourceKind.Gems, ResourceKind.Badge];

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  const heroLevel = useGameStore((s) => s.heroLevel);

  return (
    <footer className="resource-bar">
      <div className="resource-bar__group">
        {ORDER.map((kind) => {
          const meta = RESOURCE_META[kind];
          const value = resources[kind];
          return (
            <div key={kind} className="resource-item" title={meta.desc}>
              <span className="resource-item__icon" style={{ color: meta.color }}>{meta.icon}</span>
              <span className="resource-item__value" style={{ color: meta.color }}>
                {kind === ResourceKind.Exp ? `${value} (Lv.${heroLevel})` : value}
              </span>
              <span className="resource-item__name">{meta.name}</span>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
