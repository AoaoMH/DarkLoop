/**
 * 背包面板 - 支持右键菜单（穿戴/卖出）
 */

import React, { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { RARITY_COLORS, calcSellPrice } from '@shared/constants/equipment';
import { Rarity, type Equipment } from '@shared/types';
import { EquipTooltip } from './EquipTooltip';

function InventoryItemCell({ item }: { item: Equipment }) {
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number; showBelow: boolean } | null>(null);
  const equipItem = useGameStore((s) => s.equipItem);
  const sellItem = useGameStore((s) => s.sellItem);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleEquip = () => {
    equipItem(item);
    setMenu(null);
  };

  const handleSell = () => {
    sellItem(item);
    setMenu(null);
  };

  const sellPrice = calcSellPrice(item);

  return (
    <>
      <div
        className="inventory-item"
        style={{ borderColor: RARITY_COLORS[item.rarity as Rarity] || '#555' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
      >
        <div className={`inventory-item__icon ${item.icon}`}></div>
        <EquipTooltip item={item} visible={hovered} position={position || undefined} />
      </div>
      {menu && (
        <div className="inv-context-menu-overlay" onClick={() => setMenu(null)}>
          <div
            className="inv-context-menu"
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="inv-context-menu__item" onClick={handleEquip}>
              ⚔ 穿戴
            </button>
            <button className="inv-context-menu__item inv-context-menu__item--sell" onClick={handleSell}>
              💰 卖出 (+{sellPrice} 金)
            </button>
          </div>
        </div>
      )}
    </>
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
