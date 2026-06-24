import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Equipment, RolledMod, AffixDef, AffixStatKey } from '@shared/types';
import { Rarity, EquipSlot } from '@shared/types';
import { RARITY_COLORS, RARITY_NAMES, BASE_TYPES } from '@shared/constants/equipment';
import { PREFIX_DEFS, SUFFIX_DEFS, SPECIAL_AFFIX_DEFS, getTierMultiplier, calcLevelScale } from '@shared/logic/loot';
import type { SpecialAffixDef } from '@shared/logic/loot';

export interface TooltipPosition {
  x: number;
  y: number;
  showBelow: boolean;
}

interface EquipTooltipProps {
  item: Equipment;
  position?: TooltipPosition;
  visible?: boolean;
}

const SLOT_NAMES: Record<EquipSlot, string> = {
  [EquipSlot.Weapon]: '武器',
  [EquipSlot.OffHand]: '副手',
  [EquipSlot.Helmet]: '头盔',
  [EquipSlot.Armor]: '胸甲',
  [EquipSlot.Boots]: '鞋子',
  [EquipSlot.Ring1]: '戒指',
  [EquipSlot.Ring2]: '戒指',
  [EquipSlot.Amulet]: '项链',
};

const STAT_LABELS: Record<string, string> = {
  strength: '力量', agility: '敏捷', intelligence: '智力',
  vitality: '体质', spirit: '精神', luck: '运气',
  maxHp: '生命值', maxResource: '资源上限',
  physicalAttack: '物理攻击', rangedAttack: '远程攻击', magicAttack: '魔法攻击',
  armor: '护甲', magicResist: '魔法抗性',
  critRate: '暴击率', critDamage: '暴击伤害',
  accuracy: '命中', evade: '闪避',
  blockRate: '格挡率', blockValue: '格挡值', blockPercent: '格挡减伤',
  armorPierce: '护甲穿透', magicPierce: '魔法穿透',
  physicalLeech: '物理吸血', magicLeech: '魔法吸血',
  hpRegen: '生命回复', resourceRegen: '资源回复',
  cooldownReduction: '冷却缩减', statusResist: '异常抗性',
  damageReflect: '伤害反弹', speed: '速度',
  inc_damage: '全域伤害', more_damage: '额外伤害',
  elite_damage: '精英伤害', boss_damage: '首领伤害',
  bleed_chance: '流血概率', extra_element: '附加元素',
  gold_bonus: '金币加成', exp_bonus: '经验加成', luck_bonus: '运气加成',
};

const PERCENT_STATS = [
  'critRate', 'critDamage', 'blockRate', 'blockPercent', 'evade', 'accuracy',
  'statusResist', 'physicalLeech', 'magicLeech', 'cooldownReduction',
  'armorPierce', 'magicPierce', 'gold_bonus', 'exp_bonus', 'bleed_chance',
  'inc_damage', 'more_damage', 'elite_damage', 'boss_damage', 'damageReflect',
  'luck_bonus',
];

/** 全局监听 ALT 键状态 */
function useAltKey(): boolean {
  const [altDown, setAltDown] = useState(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') { e.preventDefault(); setAltDown(true); } };
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') setAltDown(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  return altDown;
}

export function EquipTooltip({ item, position, visible }: EquipTooltipProps) {
  const showAdvanced = useAltKey();

  if (!visible || !position) return null;

  const rarityName = RARITY_NAMES[item.rarity as Rarity] || item.rarity;
  const frameClass = `item-tooltip--${item.rarity}`;
  const directionClass = position.showBelow ? 'item-tooltip--below' : '';

  const baseType = BASE_TYPES.find(b => b.id === item.baseTypeId);
  const typeName = baseType?.typeName || SLOT_NAMES[item.slot as EquipSlot] || item.slot;

  // 防止 tooltip 超出屏幕右侧
  const tooltipHalfWidth = 125; // 250px / 2
  const clampedX = Math.max(tooltipHalfWidth + 10, Math.min(position.x, window.innerWidth - tooltipHalfWidth - 10));

  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${clampedX}px`,
    top: `${position.y}px`,
    opacity: 1,
    visibility: 'visible',
    pointerEvents: 'none',
    zIndex: 99999,
  };

  const formatValue = (key: string, val: number) => {
    if (PERCENT_STATS.includes(key) || (val > 0 && val < 1)) {
      return `+${(val * 100).toFixed(1)}%`;
    }
    return `+${Math.floor(val)}`;
  };

  // 查找词缀定义并计算 ALT 模式下的数值区间
  const findAffixDef = (defId: string): { baseRange: [number, number]; stat: AffixStatKey } | null => {
    const prefixDef = PREFIX_DEFS.find(d => d.id === defId);
    if (prefixDef) return { baseRange: prefixDef.baseRange, stat: prefixDef.stat };
    const suffixDef = SUFFIX_DEFS.find(d => d.id === defId);
    if (suffixDef) return { baseRange: suffixDef.baseRange, stat: suffixDef.stat };
    const specialDef = SPECIAL_AFFIX_DEFS.find(d => d.id === defId);
    if (specialDef) return { baseRange: specialDef.baseRange, stat: specialDef.stat };
    return null;
  };

  const formatRange = (stat: string, min: number, max: number) => {
    if (PERCENT_STATS.includes(stat) || (min > 0 && min < 1)) {
      return `(${(min * 100).toFixed(1)}%~${(max * 100).toFixed(1)}%)`;
    }
    return `(${Math.floor(min)}~${Math.floor(max)})`;
  };

  const renderMod = (mod: RolledMod, i: number, color?: string) => {
    const rangeText = (() => {
      if (!showAdvanced) return null;
      const def = findAffixDef(mod.defId);
      if (!def) return null;
      const levelScale = calcLevelScale(item.itemLevel);
      if (mod.tier > 0) {
        const tierMult = getTierMultiplier(mod.tier);
        return formatRange(def.stat, def.baseRange[0] * tierMult * levelScale, def.baseRange[1] * tierMult * levelScale);
      }
      // 隐式词缀 (tier=0)
      return formatRange(def.stat, def.baseRange[0] * levelScale, def.baseRange[1] * levelScale);
    })();

    return (
      <div key={i} className="item-tooltip__affix-row">
        <span className="item-tooltip__affix-name" style={color ? { color } : undefined}>
          {STAT_LABELS[mod.stat] || mod.name}
          {showAdvanced && mod.tier > 0 && (
            <span className="item-tooltip__affix-tier">T{mod.tier}</span>
          )}
        </span>
        <span className="item-tooltip__affix-val" style={color ? { color } : undefined}>
          {formatValue(mod.stat, mod.value)}
          {rangeText && <span className="item-tooltip__affix-range">{rangeText}</span>}
        </span>
      </div>
    );
  };

  // 判断是否需要显示分割线
  const hasImplicit = !!item.implicit;
  const hasPrefixes = item.prefixes.length > 0;
  const hasSuffixes = item.suffixes.length > 0;
  const hasSpecial = !!item.specialAffix;

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
        <span className="item-tooltip__req-lvl">Lv.{item.itemLevel}</span>
      </div>

      <div className="item-tooltip__divider" />

      {/* 隐式词缀（无标题，仅分割线分隔） */}
      {hasImplicit && renderMod(item.implicit!, 0, '#cccccc')}

      {/* 前缀（无标题，仅分割线分隔） */}
      {hasImplicit && hasPrefixes && <div className="item-tooltip__divider" />}
      {item.prefixes.map((mod, i) => renderMod(mod, i))}

      {/* 后缀（无标题，仅分割线分隔） */}
      {(hasImplicit || hasPrefixes) && hasSuffixes && <div className="item-tooltip__divider" />}
      {item.suffixes.map((mod, i) => renderMod(mod, i))}

      {/* 特殊词缀（Legendary，保留标题高亮） */}
      {hasSpecial && (
        <>
          <div className="item-tooltip__divider" />
          <div className="item-tooltip__section-title" style={{ color: '#ff8000' }}>特殊词缀</div>
          {renderMod(item.specialAffix!, 0, '#ff8000')}
        </>
      )}
    </div>,
    document.body
  );
}
