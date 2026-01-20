import React from 'react';
import { GameEngine } from '../game';
import { i18n } from '../i18n';
import './GameLog.css';

interface GameLogProps {
  gameEngine: GameEngine;
}

const GameLog: React.FC<GameLogProps> = ({ gameEngine }) => {
  const log = gameEngine.state.gameLog;
  const currentTurn = gameEngine.state.currentTurn;

  return (
    <div
      className="game-log"
      role="log"
      aria-label={i18n.t('gameLog')}
      aria-live="polite"
      aria-atomic="false"
    >
      <h3>{i18n.t('gameLog')}</h3>
      <div className="log-content">
        {log.length === 0 ? (
          <div className="log-empty">{i18n.t('noActionsYet')}</div>
        ) : (
          <ul className="log-entries">
            {log
              .slice()
              .reverse()
              .map((entry, index) => (
                <li
                  key={`${entry.turn}-${index}`}
                  className={`log-entry ${index === 0 ? 'latest' : ''}`}
                  aria-label={`${i18n.t('turn')} ${entry.turn}, ${entry.playerName}, ${entry.action}`}
                >
                  <span className="log-turn" aria-hidden="true">
                    T{entry.turn}
                  </span>
                  <span className="log-player" aria-hidden="true">
                    {entry.playerName}:
                  </span>
                  <span className="log-action">{entry.action}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="log-footer">
        {i18n.t('turn')} {currentTurn}
      </div>
    </div>
  );
};

export default GameLog;
