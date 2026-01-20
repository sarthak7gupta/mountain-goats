import React, { useState } from 'react';
import { i18n } from '../i18n';
import { PlayerColor } from '../models';
import './PlayerSetup.css';

interface PlayerSetupProps {
  onStart: (playerNames: string[]) => void;
}

const PlayerSetup: React.FC<PlayerSetupProps> = ({ onStart }) => {
  const [players, setPlayers] = useState<string[]>(['Player 1', 'Player 2', 'Player 3']);
  const colorOrder: PlayerColor[] = [
    PlayerColor.BLACK,
    PlayerColor.WHITE,
    PlayerColor.RED,
    PlayerColor.YELLOW,
  ];

  const addPlayer = () => {
    if (players.length < 4) {
      setPlayers([...players, `Player ${players.length + 1}`]);
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
    newPlayers[index] = name || `Player ${index + 1}`;
    setPlayers(newPlayers);
  };

  const startGame = () => {
    onStart(players);
  };

  const getColorClass = (index: number): string => {
    const color = colorOrder[index];
    return color ? color.toLowerCase() : '';
  };

  return (
    <div className="player-setup" role="main">
      <div className="setup-container">
        <h2>Player Setup</h2>

        <div className="players-list">
          {players.map((player, index) => (
            <div key={index} className="player-input-row">
              <div className={`player-color-indicator ${getColorClass(index)}`}></div>
              <input
                type="text"
                value={player}
                placeholder={`${i18n.t('player')} ${index + 1}`}
                onInput={(e) => updatePlayerName(index, e.currentTarget.value)}
                className="player-name-input"
                aria-label={`${i18n.t('player')} ${index + 1} name`}
              />
              {players.length > 2 && (
                <button
                  type="button"
                  onClick={() => removePlayer(index)}
                  className="remove-player-btn"
                  aria-label={`${i18n.t('removePlayer')} ${player}`}
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
            disabled={players.length < 2}
            aria-label={i18n.t('startGame')}
            aria-disabled={players.length < 2}
          >
            {i18n.t('startGame')}
          </button>
        </div>

        <div className="player-count-info">
          {players.length < 2 && <p className="error-message">Minimum 2 players required</p>}
          {players.length === 4 && <p className="info-message">Maximum 4 players</p>}
        </div>
      </div>
    </div>
  );
};

export default PlayerSetup;
