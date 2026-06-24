/**
 * 右侧角色状态面板 - 装备栏 + 属性（双视图：默认/详细）
 */

import React, { useState, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { RARITY_COLORS, SLOT_ORDER, SLOT_LABELS } from '@shared/constants/equipment';
import { calcHeroDerived, calcDerivedStats } from '@shared/logic/combat';
import type { Rarity, DerivedStats, PrimaryStats, Equipment, EquipSlot } from '@shared/types';
import { EquipSlot as ES } from '@shared/types';
import { EquipTooltip } from './EquipTooltip';
import { EquipSelectPopup } from './EquipSelectPopup';

const EQUIPMENT_SLOTS = SLOT_ORDER;

const PRIMARY_STAT_META: Array<{ key: keyof PrimaryStats; label: string; icon: string }> = [
  { key: 'strength', label: '力量', icon: '💪' },
  { key: 'agility', label: '敏捷', icon: '🏃' },
  { key: 'intelligence', label: '智力', icon: '🔮' },
  { key: 'vitality', label: '体质', icon: '❤️' },
  { key: 'spirit', label: '精神', icon: '✨' },
  { key: 'luck', label: '运气', icon: '🍀' },
];

const CORE_DERIVED: Array<{ key: keyof DerivedStats; label: string; fmt: 'int' | 'pct' }> = [
  { key: 'maxHp', label: '生命值', fmt: 'int' },
  { key: 'maxResource', label: '怒气上限', fmt: 'int' },
  { key: 'physicalAttack', label: '物理攻击', fmt: 'int' },
  { key: 'armor', label: '护甲', fmt: 'int' },
  { key: 'critRate', label: '暴击率', fmt: 'pct' },
  { key: 'critDamage', label: '暴击伤害', fmt: 'pct' },
  { key: 'speed', label: '速度', fmt: 'int' },
];

const DETAIL_SECTIONS: Array<{ title: string; items: Array<{ key: keyof DerivedStats; label: string; fmt: 'int' | 'pct' | 'fp2' }> }> = [
  {
    title: '攻击',
    items: [
      { key: 'physicalAttack', label: '物理攻击', fmt: 'int' },
      { key: 'rangedAttack', label: '远程攻击', fmt: 'int' },
      { key: 'magicAttack', label: '魔法攻击', fmt: 'int' },
      { key: 'critRate', label: '暴击率', fmt: 'pct' },
      { key: 'critDamage', label: '暴击伤害', fmt: 'pct' },
      { key: 'accuracy', label: '命中', fmt: 'pct' },
      { key: 'armorPierce', label: '护甲穿透', fmt: 'pct' },
      { key: 'magicPierce', label: '魔法穿透', fmt: 'pct' },
      { key: 'physicalLeech', label: '物理吸血', fmt: 'pct' },
      { key: 'magicLeech', label: '魔法吸血', fmt: 'pct' },
      { key: 'cooldownReduction', label: '冷却缩减', fmt: 'pct' },
    ],
  },
  {
    title: '防御',
    items: [
      { key: 'maxHp', label: '最大生命', fmt: 'int' },
      { key: 'armor', label: '护甲', fmt: 'int' },
      { key: 'magicResist', label: '魔法抗性', fmt: 'int' },
      { key: 'evade', label: '闪避', fmt: 'pct' },
      { key: 'blockRate', label: '格挡率', fmt: 'pct' },
      { key: 'blockValue', label: '格挡值', fmt: 'int' },
      { key: 'blockPercent', label: '格挡减伤', fmt: 'pct' },
      { key: 'statusResist', label: '异常抗性', fmt: 'pct' },
      { key: 'damageReflect', label: '伤害反弹', fmt: 'pct' },
    ],
  },
  {
    title: '回复',
    items: [
      { key: 'hpRegen', label: '每回合回血', fmt: 'fp2' },
      { key: 'resourceRegen', label: '每回合回怒', fmt: 'fp2' },
      { key: 'maxResource', label: '怒气上限', fmt: 'int' },
    ],
  },
  {
    title: '机动',
    items: [
      { key: 'speed', label: '速度', fmt: 'int' },
    ],
  },
];

function fmtVal(v: number, fmt: 'int' | 'pct' | 'fp2'): string {
  if (fmt === 'int') return Math.floor(v).toString();
  if (fmt === 'pct') return `${(v * 100).toFixed(1)}%`;
  return v.toFixed(2);
}

interface EquipmentSlotCellProps {
  slotName: string;
  slotIndex: number;
  equipped?: Equipment;
  onClick?: () => void;
}

function EquipmentSlotCell({ slotName, slotIndex, equipped, onClick }: EquipmentSlotCellProps) {
  const [hovered, setHovered] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number; showBelow: boolean } | null>(null);
  const unequipItem = useGameStore((s) => s.unequipItem);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!equipped) return;
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
    if (!equipped) return;
    e.preventDefault();
    unequipItem(slotIndex);
  };

  return (
    <div
      className="equipment-slot"
      style={
        equipped
          ? {
              boxShadow: `2px 2px 0 rgba(0,0,0,0.4), 0 0 8px ${RARITY_COLORS[equipped.rarity as Rarity] || '#333'}`,
            }
          : undefined
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      <div className="equipment-slot__label">{slotName}</div>
      <div className={`equipment-slot__icon ${equipped ? equipped.icon : ''}`}>
        {!equipped && '?'}
      </div>
      {equipped && (
        <EquipTooltip item={equipped} visible={hovered} position={position || undefined} />
      )}
    </div>
  );
}

export function CharacterPanel() {
  const hero = useGameStore((s) => s.hero);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const derived = useMemo<DerivedStats | null>(() => {
    if (!hero) return null;
    return calcHeroDerived(hero);
  }, [hero]);

  if (!hero || !derived) return null;

  return (
    <div className="character-panel">
      {/* 角色头部信息 */}
      <div className="character-panel__header">
        <div className="character-panel__avatar">
          <span className="character-panel__class-icon">
            {hero.class === 'warrior' ? '⚔️' : hero.class === 'mage' ? '🔮' : '🏹'}
          </span>
        </div>
        <div className="character-panel__info">
          <div className="character-panel__name">{hero.name}</div>
          <div className="character-panel__level">Lv.{hero.level}</div>
        </div>
      </div>

      {/* 装备栏 */}
      <div className="character-panel__equipment">
        <div className="character-panel__section-title">装备</div>
        <div className="equipment-grid">
          {EQUIPMENT_SLOTS.map((slot: EquipSlot, index: number) => {
            const equipped = hero.equipment[index];
            return (
              <EquipmentSlotCell
                key={slot}
                slotName={SLOT_LABELS[slot]}
                slotIndex={index}
                equipped={equipped}
                onClick={() => setSelectedSlot(index)}
              />
            );
          })}
        </div>
      </div>

      {selectedSlot !== null && (
        <EquipSelectPopup
          slotIndex={selectedSlot}
          slot={SLOT_ORDER[selectedSlot]}
          onClose={() => setSelectedSlot(null)}
        />
      )}

      {/* 属性面板 */}
      <div className="character-panel__stats">
        <div className="character-panel__section-title">
          <span>属性</span>
          <button
            className="character-panel__toggle-btn"
            onClick={() => setShowDetail((v) => !v)}
          >
            {showDetail ? '默认视图' : '详细属性'}
          </button>
        </div>

        {!showDetail ? (
          <>
            <div className="stats-list">
              {PRIMARY_STAT_META.map((m) => (
                <div className="stat-item" key={m.key}>
                  <span className="stat-item__label">
                    <span className="stat-item__icon">{m.icon}</span>
                    {m.label}
                  </span>
                  <span className="stat-item__value">{Math.floor(hero.stats[m.key])}</span>
                </div>
              ))}
            </div>
            <div className="stats-list stats-list--divider">
              {CORE_DERIVED.map((m) => (
                <div className="stat-item stat-item--derived" key={m.key}>
                  <span className="stat-item__label">{m.label}</span>
                  <span className="stat-item__value">{fmtVal(derived[m.key], m.fmt)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="stats-detail">
            {DETAIL_SECTIONS.map((sec) => (
              <div className="stats-detail__section" key={sec.title}>
                <div className="stats-detail__title">{sec.title}</div>
                <div className="stats-list">
                  {sec.items.map((m) => (
                    <div className="stat-item stat-item--derived" key={m.key}>
                      <span className="stat-item__label">{m.label}</span>
                      <span className="stat-item__value">{fmtVal(derived[m.key], m.fmt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
