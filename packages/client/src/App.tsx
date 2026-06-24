/**
 * DarkLoop - 主应用组件
 * 布局：顶部装饰 | 左菜单 | 中渲染区(按菜单切换) | 右角色 | 底资源栏
 */

import React, { useEffect, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { TurnBattleUI } from './components/TurnBattleUI';
import { SideMenu, type MenuKey } from './components/SideMenu';
import { CharacterPanel } from './components/CharacterPanel';
import { ResourceBar } from './components/ResourceBar';
import { InventoryPanel } from './components/InventoryPanel';
import { AdventureMap } from './components/AdventureMap';
import { TalentPanel } from './components/TalentPanel';
import { useGameStore } from './stores/gameStore';

export default function App() {
  const initGame = useGameStore((s) => s.initGame);
  const startBattle = useGameStore((s) => s.startBattle);
  const isBattling = useGameStore((s) => s.isBattling);
  const [activeMenu, setActiveMenu] = useState<MenuKey>('adventure');

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleStartLevel = (levelId: string) => {
    startBattle(levelId);
  };

  const renderCenter = () => {
    if (isBattling) {
      return (
        <div className="battle-stage">
          <GameCanvas />
          <TurnBattleUI />
        </div>
      );
    }
    switch (activeMenu) {
      case 'adventure':
        return <AdventureMap onStartLevel={handleStartLevel} />;
      case 'talent':
        return <TalentPanel />;
      case 'inventory':
        return <InventoryPanel />;
      default:
        return <AdventureMap onStartLevel={handleStartLevel} />;
    }
  };

  return (
    <div className="app-container">
      <header className="top-decoration">
        <div className="top-decoration__line" />
        <div className="top-decoration__title">DarkLoop</div>
        <div className="top-decoration__line" />
      </header>

      <div className="main-content">
        <SideMenu activeMenu={activeMenu} onMenuChange={setActiveMenu} />
        <div className="game-area">{renderCenter()}</div>
        <CharacterPanel />
      </div>

      <ResourceBar />
    </div>
  );
}
