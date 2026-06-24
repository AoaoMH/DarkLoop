/**
 * 左侧主菜单 - v1 只解锁冒险和背包，其余锁定
 */

import React from 'react';

export type MenuKey = 'adventure' | 'inventory' | 'talent';

interface MenuItem {
  key: MenuKey;
  label: string;
  icon: string;
  locked?: boolean;
  lockHint?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'adventure', label: '冒险', icon: '⚔️' },
  { key: 'talent', label: '天赋', icon: '🌟' },
  { key: 'inventory', label: '背包', icon: '🎒' },
  // 后续迭代解锁
  { key: 'inventory', label: '铁匠铺', icon: '🔨', locked: true, lockHint: '后续版本解锁' },
  { key: 'inventory', label: '农田', icon: '🌾', locked: true, lockHint: '后续版本解锁' },
  { key: 'inventory', label: '矿洞', icon: '⛏️', locked: true, lockHint: '后续版本解锁' },
];

interface SideMenuProps {
  activeMenu: MenuKey;
  onMenuChange: (menu: MenuKey) => void;
}

export function SideMenu({ activeMenu, onMenuChange }: SideMenuProps) {
  return (
    <nav className="side-menu">
      <div className="side-menu__header">
        <span className="side-menu__logo">DL</span>
      </div>
      <ul className="side-menu__list">
        {MENU_ITEMS.map((item, idx) => {
          const locked = !!item.locked;
          const isActive = !locked && activeMenu === item.key;
          return (
            <li key={idx} className="side-menu__item-wrapper">
              <button
                className={`side-menu__item ${isActive ? 'side-menu__item--active' : ''} ${locked ? 'side-menu__item--locked' : ''}`}
                onClick={() => !locked && onMenuChange(item.key)}
                disabled={locked}
                title={locked ? item.lockHint : item.label}
              >
                <span className="side-menu__row">
                  <span className="side-menu__icon">{item.icon}</span>
                  <span className="side-menu__label">{item.label}</span>
                  <span className="side-menu__lock" style={{ visibility: locked ? 'visible' : 'hidden' }}>🔒</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
