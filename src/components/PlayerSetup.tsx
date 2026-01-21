import React, { useState } from 'react';
import { i18n } from '../i18n';
import { PlayerColor } from '../models';
import './PlayerSetup.css';

interface PlayerSetupProps {
  onStart: (playerNames: string[]) => void;
}

interface PlayerWithColor {
  name: string;
  color: PlayerColor;
}

const PlayerSetup: React.FC<PlayerSetupProps> = ({ onStart }) => {
  const colorOrder: PlayerColor[] = [
    PlayerColor.BLACK,
    PlayerColor.WHITE,
    PlayerColor.RED,
    PlayerColor.YELLOW,
  ];

  const [players, setPlayers] = useState<PlayerWithColor[]>([
    { name: 'Player 1', color: colorOrder[0] },
    { name: 'Player 2', color: colorOrder[1] },
    { name: 'Player 3', color: colorOrder[2] },
  ]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const addPlayer = () => {
    if (players.length < 4) {
      setPlayers([
        ...players,
        { name: `Player ${players.length + 1}`, color: colorOrder[players.length] },
      ]);
    }
  };

  const removePlayer = (index: number) => {
    if (players.length > 2) {
      const newPlayers = players.filter((_, i) => i !== index);
      setPlayers(newPlayers);
    }
  };

  const updatePlayerName = (index: number, name: string) => {
    const newPlayers = [...players];
    newPlayers[index] = { ...newPlayers[index], name };
    setPlayers(newPlayers);
  };

  const startGame = () => {
    onStart(players.map((p) => p.name));
  };

  const hasEmptyName = () => {
    return players.some((player) => !player.name || player.name.trim() === '');
  };

  const getColorClass = (player: PlayerWithColor): string => {
    return player.color.toLowerCase();
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const newPlayers = [...players];
      const draggedPlayer = newPlayers[draggedIndex];

      // Remove the dragged item first
      newPlayers.splice(draggedIndex, 1);

      // Calculate insertion index
      // When dragging down: insert after target (dropIndex becomes dropIndex after removal)
      // When dragging up: insert before target (dropIndex stays the same)
      let insertIndex: number;
      if (draggedIndex < dropIndex) {
        // Dragging down: want to insert after the target
        // After removing dragged item, target is now at dropIndex - 1
        // Insert after it, so at dropIndex
        insertIndex = dropIndex;
      } else {
        // Dragging up: insert before target
        insertIndex = dropIndex;
      }

      // Insert the dragged player (with its color) at the new position
      newPlayers.splice(insertIndex, 0, draggedPlayer);
      setPlayers(newPlayers);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="player-setup" role="main">
      <div className="setup-container">
        <h2>Player Setup</h2>

        <div className="players-list">
          {players.map((player, index) => (
            <div
              key={index}
              className={`player-input-row ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="drag-handle" aria-label="Drag to reorder" title="Drag to reorder">
                ⋮⋮
              </div>
              <div className={`player-color-indicator ${getColorClass(player)}`}></div>
              <input
                type="text"
                value={player.name}
                placeholder={`${i18n.t('player')} ${index + 1}`}
                onInput={(e) => updatePlayerName(index, e.currentTarget.value)}
                onDragStart={(e) => e.stopPropagation()}
                className="player-name-input"
                aria-label={`${i18n.t('player')} ${index + 1} name`}
              />
              {players.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePlayer(index)}
                  onDragStart={(e) => e.stopPropagation()}
                  className="remove-player-btn"
                  aria-label={`${i18n.t('removePlayer')} ${player.name}`}
                  title={i18n.t('removePlayer')}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="setup-actions">
          {players.length < 4 && (
            <button
              type="button"
              onClick={addPlayer}
              className="add-player-btn"
              aria-label={i18n.t('addPlayer')}
            >
              + {i18n.t('addPlayer')}
            </button>
          )}
          <button
            type="button"
            onClick={startGame}
            className="start-game-btn"
            disabled={players.length < 2 || hasEmptyName()}
            aria-label={i18n.t('startGame')}
            aria-disabled={players.length < 2 || hasEmptyName()}
          >
            {i18n.t('startGame')}
          </button>
        </div>

        <div className="player-count-info">
          {players.length < 2 && <p className="error-message">Minimum 2 players required</p>}
          {players.length >= 2 && hasEmptyName() && (
            <p className="error-message">All players must have a name</p>
          )}
          {players.length === 4 && <p className="info-message">Maximum 4 players</p>}
        </div>
      </div>
    </div>
  );
};

export default PlayerSetup;
