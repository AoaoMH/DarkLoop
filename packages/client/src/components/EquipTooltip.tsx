import React from 'react';
import { createPortal } from 'react-dom';
import type { Equipment } from '@shared/types';
import { Rarity, EquipSlot } from '@shared/types';
import { RARITY_COLORS, RARITY_NAMES } from '@shared/constants/equipment';

export interface TooltipPosition {
  x: number; // 格子的绝对 X 轴中点屏幕坐标
  y: number; // 格子的绝对 Y 轴对齐屏幕坐标
  showBelow: boolean; // 是否向下弹出
}

interface EquipTooltipProps {
  item: Equipment;
  position?: TooltipPosition;
  visible?: boolean;
}

const SLOT_NAMES: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: '武器',
  [EquipSlot.Helmet]: '头盔',
  [EquipSlot.Armor]: '胸甲',
  [EquipSlot.Boots]: '鞋子',
  [EquipSlot.Ring]: '戒指',
  [EquipSlot.Amulet]: '项链',
};

const STAT_LABELS: Record<string, string> = {
  strength: '力量',
  agility: '敏捷',
  intelligence: '智力',
  vitality: '体质',
  spirit: '精神',
  luck: '运气',
};

export function EquipTooltip({ item, position, visible }: EquipTooltipProps) {
  if (!visible || !position) return null;

  const rarityName = RARITY_NAMES[item.rarity as Rarity] || item.rarity;
  const frameClass = `item-tooltip--${item.rarity}`;
  const directionClass = position.showBelow ? 'item-tooltip--below' : '';

  // 挂载到 body 下，应用绝对 fixed 定位，使其图层置于所有组件之上
  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    opacity: 1,
    visibility: 'visible',
    pointerEvents: 'none',
    zIndex: 99999,
  };

  const formatValue = (key: string, val: number) => {
    const pctStats = [
      'critRate', 'critDamage', 'blockRate', 'blockPercent', 'evade', 'accuracy',
      'statusResist', 'physicalLeech', 'magicLeech', 'cooldownReduction',
      'armorPierce', 'magicPierce', 'gold_bonus', 'exp_bonus', 'bleed_chance',
      'inc_damage', 'more_damage', 'elite_damage', 'boss_damage'
    ];
    if (pctStats.includes(key) || (val > 0 && val < 1)) {
      return `+${(val * 100).toFixed(1)}%`;
    }
    return `+${Math.floor(val)}`;
  };

  return createPortal(
    <div className={`item-tooltip ${frameClass} ${directionClass}`} style={style}>
      {/* 头部：名称 & 部位 */}
      <div className="item-tooltip__header">
        <span
          className="item-tooltip__name"
          style={item.rarity === Rarity.Apex ? undefined : { color: RARITY_COLORS[item.rarity as Rarity] }}
        >
          {item.name}
        </span>
        <span className="item-tooltip__slot">
          {SLOT_NAMES[item.slot as EquipSlot] || item.slot}
        </span>
      </div>

      {/* 稀有度与等级 */}
      <div className="item-tooltip__rarity-lvl">
        <span
          className="item-tooltip__rarity"
          style={item.rarity === Rarity.Apex ? undefined : { color: RARITY_COLORS[item.rarity as Rarity] }}
        >
          {rarityName}
        </span>
        <span className="item-tooltip__req-lvl">Lv.{item.requiredLevel} 装备</span>
      </div>

      <div className="item-tooltip__divider" />

      {/* 基础属性 */}
      <div className="item-tooltip__base-stats">
        <div className="item-tooltip__section-title">基础属性</div>
        {Object.entries(item.baseStats).map(([key, val]) => {
          if (!val) return null;
          return (
            <div key={key} className="item-tooltip__stat-row">
              <span className="item-tooltip__stat-label">{STAT_LABELS[key] || key}</span>
              <span className="item-tooltip__stat-value">{formatValue(key, val)}</span>
            </div>
          );
        })}
      </div>

      {item.affixes.length > 0 && (
        <>
          <div className="item-tooltip__divider" />
          {/* 附加词缀 */}
          <div className="item-tooltip__affixes">
            <div className="item-tooltip__section-title">附加词缀</div>
            {item.affixes.map((aff, i) => (
              <div key={i} className="item-tooltip__affix-row">
                <span className="item-tooltip__affix-name">{aff.name}</span>
                <span className="item-tooltip__affix-val">{formatValue(aff.stat, aff.value)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
