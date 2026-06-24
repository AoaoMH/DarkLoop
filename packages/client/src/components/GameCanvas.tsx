/**
 * Phaser 游戏画布容器
 * 管理 Phaser 游戏实例的生命周期
 */

import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { phaserConfig } from '../game/config';

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config = {
      ...phaserConfig,
      parent: containerRef.current,
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="game-canvas" />;
}
