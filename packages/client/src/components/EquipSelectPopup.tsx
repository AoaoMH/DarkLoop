/**
 * 装备选择弹窗 - 点击装备槽位时弹出，显示可装备的物品列表
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../stores/gameStore';
import { RARITY_COLORS, SLOT_LABELS, SLOT_ORDER, BASE_TYPES, calcSellPrice } from '@shared/constants/equipment';
import { calcHeroDerived, calcDerivedStats } from '@shared/logic/combat';
import type { Rarity, Equipment, DerivedStats } from '@shared/types';
import { EquipSlot } from '@shared/types';
import { EquipTooltip } from './EquipTooltip';

interface EquipSelectPopupProps {
  slotIndex: number;
  slot: EquipSlot;
  onClose: () => void;
}

const DIFF_STATS: Array<{ key: keyof DerivedStats; label: string; fmt: 'int' | 'pct' }> = [
  { key: 'maxHp', label: '生命', fmt: 'int' },
  { key: 'physicalAttack', label: '物攻', fmt: 'int' },
  { key: 'rangedAttack', label: '远攻', fmt: 'int' },
  { key: 'magicAttack', label: '魔攻', fmt: 'int' },
  { key: 'armor', label: '护甲', fmt: 'int' },
  { key: 'magicResist', label: '魔抗', fmt: 'int' },
  { key: 'critRate', label: '暴击', fmt: 'pct' },
  { key: 'critDamage', label: '爆伤', fmt: 'pct' },
  { key: 'speed', label: '速度', fmt: 'int' },
  { key: 'accuracy', label: '命中', fmt: 'pct' },
  { key: 'evade', label: '闪避', fmt: 'pct' },
];

function fmtDiff(v: number, fmt: 'int' | 'pct'): string {
  if (fmt === 'pct') return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
  return `${v >= 0 ? '+' : ''}${Math.floor(v)}`;
}

export function EquipSelectPopup({ slotIndex, slot, onClose }: EquipSelectPopupProps) {
  const hero = useGameStore((s) => s.hero);
  const inventory = useGameStore((s) => s.inventory);
  const equipItem = useGameStore((s) => s.equipItem);
  const [hoveredItem, setHoveredItem] = useState<Equipment | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; showBelow: boolean } | null>(null);

  const currentDerived = useMemo(() => {
    if (!hero) return null;
    return calcHeroDerived(hero);
  }, [hero]);

  // 过滤可装备的物品
  const compatibleItems = useMemo(() => {
    if (!hero) return [];
    return inventory.filter((item) => {
      // 戒指槽可以互相兼容
      if (slot === EquipSlot.Ring1 || slot === EquipSlot.Ring2) {
        return item.slot === EquipSlot.Ring1 || item.slot === EquipSlot.Ring2;
      }
      return item.slot === slot;
    });
  }, [inventory, slot, hero]);

  // 计算装备某物品后的属性差异
  const calcDiff = (item: Equipment): Array<{ label: string; diff: number; fmt: 'int' | 'pct' }> => {
    if (!hero || !currentDerived) return [];
    const simEquipment = [...hero.equipment];
    while (simEquipment.length < SLOT_ORDER.length) simEquipment.push(undefined as any);
    simEquipment[slotIndex] = item;
    const newDerived = calcDerivedStats(
      hero.stats,
      simEquipment.filter(Boolean) as Equipment[],
      hero.level,
    );
    const diffs: Array<{ label: string; diff: number; fmt: 'int' | 'pct' }> = [];
    for (const meta of DIFF_STATS) {
      const diff = newDerived[meta.key] - currentDerived[meta.key];
      if (Math.abs(diff) > 0.01) {
        diffs.push({ label: meta.label, diff, fmt: meta.fmt });
      }
    }
    return diffs;
  };

  if (!hero) return null;

  const handleEquip = (item: Equipment) => {
    equipItem(item);
    onClose();
  };

  const handleMouseEnter = (e: React.MouseEvent, item: Equipment) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const showBelow = rect.top < 300;
    setTooltipPos({
      x: rect.right + 8,
      y: showBelow ? rect.top : rect.bottom,
      showBelow,
    });
    setHoveredItem(item);
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  const currentlyEquipped = hero.equipment[slotIndex];

  return createPortal(
    <div className="equip-popup-overlay" onClick={onClose}>
      <div className="equip-popup" onClick={(e) => e.stopPropagation()}>
        <div className="equip-popup__header">
          <span className="equip-popup__title">{SLOT_LABELS[slot]} - 选择装备</span>
          <button className="equip-popup__close" onClick={onClose}>✕</button>
        </div>

        <div className="equip-popup__body">
          {/* 当前装备 */}
          {currentlyEquipped && (
            <div className="equip-popup__section">
              <div className="equip-popup__section-title">当前装备</div>
              <div
                className="equip-popup__item equip-popup__item--current"
                style={{ borderColor: RARITY_COLORS[currentlyEquipped.rarity as Rarity] || '#555' }}
              >
                <div className={`equip-popup__item-icon ${currentlyEquipped.icon}`} />
                <div className="equip-popup__item-info">
                  <span style={{ color: RARITY_COLORS[currentlyEquipped.rarity as Rarity] }}>
                    {currentlyEquipped.name}
                  </span>
                  <span className="equip-popup__item-level">Lv.{currentlyEquipped.itemLevel}</span>
                </div>
              </div>
            </div>
          )}

          {/* 可装备列表 */}
          <div className="equip-popup__section">
            <div className="equip-popup__section-title">
              可装备 ({compatibleItems.length})
            </div>
            {compatibleItems.length === 0 ? (
              <div className="equip-popup__empty">背包中没有可装备的物品</div>
            ) : (
              <div className="equip-popup__list">
                {compatibleItems.map((item) => {
                  const diffs = calcDiff(item);
                  return (
                    <div
                      key={item.id}
                      className="equip-popup__item"
                      style={{ borderColor: RARITY_COLORS[item.rarity as Rarity] || '#555' }}
                      onClick={() => handleEquip(item)}
                      onMouseEnter={(e) => handleMouseEnter(e, item)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className={`equip-popup__item-icon ${item.icon}`} />
                      <div className="equip-popup__item-info">
                        <span style={{ color: RARITY_COLORS[item.rarity as Rarity] }}>
                          {item.name}
                        </span>
                        <span className="equip-popup__item-level">Lv.{item.itemLevel}</span>
                      </div>
                      {/* 属性差异预览 */}
                      {diffs.length > 0 && (
                        <div className="equip-popup__diff">
                          {diffs.map((d, i) => (
                            <span
                              key={i}
                              className={d.diff > 0 ? 'equip-popup__diff-up' : 'equip-popup__diff-down'}
                            >
                              {fmtDiff(d.diff, d.fmt)} {d.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 悬浮 tooltip */}
        {hoveredItem && tooltipPos && (
          <EquipTooltip item={hoveredItem} visible={true} position={tooltipPos} />
        )}
      </div>
    </div>,
    document.body,
  );
}
