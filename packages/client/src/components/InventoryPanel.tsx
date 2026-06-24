/**
 * 背包面板
 */

import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { RARITY_COLORS } from '@shared/constants/equipment';
import { Rarity, type Equipment } from '@shared/types';
import { EquipTooltip } from './EquipTooltip';

function InventoryItemCell({ item }: { item: Equipment }) {
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
      className="inventory-item"
      style={{ borderColor: RARITY_COLORS[item.rarity as Rarity] || '#555' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`inventory-item__icon ${item.icon}`}></div>
      <EquipTooltip item={item} visible={hovered} position={position || undefined} />
    </div>
  );
}

export function InventoryPanel() {
  const inventory = useGameStore((s) => s.inventory);

  return (
    <div className="panel inventory-panel">
      <h3 className="panel__title">背包 ({inventory.length})</h3>
      <div className="panel__content inventory-grid">
        {inventory.map((item) => (
          <InventoryItemCell key={item.id} item={item} />
        ))}
        {/* 空格子 */}
        {Array.from({ length: Math.max(0, 20 - inventory.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="inventory-item inventory-item--empty" />
        ))}
      </div>
    </div>
  );
}
