import React from 'react';
import { GameEngine } from '../game';
import { i18n } from '../i18n';
import { PlayerColor } from '../models';
import './WinScreen.css';

interface WinScreenProps {
  gameEngine: GameEngine;
  onReset: () => void;
}

const WinScreen: React.FC<WinScreenProps> = ({ gameEngine, onReset }) => {
  const winners = gameEngine.getWinners();
  const isTie = winners.length > 1;

  const getPlayerColor = (color: PlayerColor): string => {
    const colors: Record<PlayerColor, string> = {
      [PlayerColor.BLACK]: '#212121',
      [PlayerColor.WHITE]: '#F5F5F5',
      [PlayerColor.RED]: '#F44336',
      [PlayerColor.YELLOW]: '#FFEB3B',
    };
    return colors[color] || '#fff';
  };

  return (
    <div className="win-screen" role="dialog" aria-labelledby="win-title" aria-modal="true">
      <div className="win-content">
        <div className="win-icon">🏆</div>
        <h1 id="win-title" className="win-title">
          {i18n.t('gameOverWinner')}
        </h1>

        {isTie ? (
          <div className="winners-list">
            <p className="tie-message">{i18n.t('winningText')}</p>
            {winners.map((winner, index) => (
              <div key={index} className="winner-card">
                <div
                  className="winner-color-indicator"
                  style={{ backgroundColor: getPlayerColor(winner.color) }}
                  role="img"
                  aria-label={`${i18n.t('ariaPlayer')} color: ${winner.color}`}
                />
                <div className="winner-info">
                  <div className="winner-name">{winner.name}</div>
                  <div className="winner-score">
                    {i18n.t('withPoints')} <strong>{winner.score}</strong> {i18n.t('points')}
                  </div>
                </div>
              </div>
            ))}
            <p className="tie-note">🎉 {i18n.t('wins')}!</p>
          </div>
        ) : (
          <div className="winner-card single-winner">
            <div
              className="winner-color-indicator"
              style={{ backgroundColor: getPlayerColor(winners[0].color) }}
              role="img"
              aria-label={`${i18n.t('ariaPlayer')} color: ${winners[0].color}`}
            />
            <div className="winner-info">
              <div className="winner-name">{winners[0].name}</div>
              <div className="winner-score">
                {i18n.t('wins')} {i18n.t('withPoints')} <strong>{winners[0].score}</strong>{' '}
                {i18n.t('points')}!
              </div>
            </div>
          </div>
        )}

        <div className="final-scores">
          <h2>
            {i18n.t('score')} {i18n.t('playersText')}
          </h2>
          <div className="scores-list">
            {gameEngine.state.players
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div
                  key={index}
                  className={`score-item ${winners.some((w) => w.name === player.name) ? 'winner' : ''}`}
                >
                  <div
                    className="score-color-indicator"
                    style={{ backgroundColor: getPlayerColor(player.color) }}
                  />
                  <span className="score-name">{player.name}</span>
                  <span className="score-value">{player.score}</span>
                </div>
              ))}
          </div>
        </div>

        <button type="button" onClick={onReset} className="reset-game-btn">
          {i18n.t('backToSetup')}
        </button>
      </div>
    </div>
  );
};

export default WinScreen;
