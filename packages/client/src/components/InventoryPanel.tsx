/**
 * 背包面板
 */

import React from 'react';
import { useGameStore } from '../stores/gameStore';
import { RARITY_COLORS } from '@shared/constants/equipment';
import { Rarity } from '@shared/types';

export function InventoryPanel() {
  const inventory = useGameStore((s) => s.inventory);

  return (
    <div className="panel inventory-panel">
      <h3 className="panel__title">背包 ({inventory.length})</h3>
      <div className="panel__content inventory-grid">
        {inventory.map((item) => (
          <div
            key={item.id}
            className="inventory-item"
            style={{ borderColor: RARITY_COLORS[item.rarity as Rarity] || '#555' }}
            title={`${item.name}\n${item.slot}`}
          >
            <div className="inventory-item__icon">{item.icon || '?'}</div>
          </div>
        ))}
        {/* 空格子 */}
        {Array.from({ length: Math.max(0, 20 - inventory.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="inventory-item inventory-item--empty" />
        ))}
      </div>
    </div>
  );
}
