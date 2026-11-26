import type React from 'react';
import { GameEngine } from '../game';
import { i18n } from '../i18n';
import { CellNumber, PlayerColor } from '../models';
import './MountainColumn.css';

interface MountainColumnProps {
  gameEngine: GameEngine;
  cellNumber: CellNumber;
  forceUpdate?: () => void;
  /** Changes after every engine mutation so the column re-renders. */
  updateTrigger?: number;
}

const MountainColumn: React.FC<MountainColumnProps> = ({ gameEngine, cellNumber, forceUpdate }) => {
  // The engine mutates its state in place; the parent re-renders this column after every
  // change, so read current values directly instead of memoizing on object identity.
  const state = gameEngine.state;
  const cells = state.cells[cellNumber];
  const currentPlayer = gameEngine.getCurrentPlayer();
  const isValidTarget = gameEngine.getValidMountainTargets().includes(cellNumber);
  const selectedSum = gameEngine.getSelectedDiceSum();
  const tokenCount = state.pointTokens.filter((t) => t.available && t.value === cellNumber).length;
  const pieces = state.playerPieces[cellNumber] || [];
  const hasPlayerGoat =
    pieces.includes(currentPlayer.color) ||
    cells.some((cell) => cell.occupiedBy.includes(currentPlayer.color));

  const handleGoatClick = () => {
    if (isValidTarget && selectedSum > 0) {
      const moved = gameEngine.moveGoatUpMountain(cellNumber);
      if (moved && forceUpdate) {
        forceUpdate();
      }
    }
  };

  const getMountainBackground = (cellNum: CellNumber): string => {
    const backgrounds: Record<CellNumber, string> = {
      [CellNumber.FIVE]: 'mountain-5', // Green hills
      [CellNumber.SIX]: 'mountain-6', // Orange fields
      [CellNumber.SEVEN]: 'mountain-7', // Brown dirt
      [CellNumber.EIGHT]: 'mountain-8', // Grey rocks
      [CellNumber.NINE]: 'mountain-9', // Blue water
      [CellNumber.TEN]: 'mountain-10', // Lighter blue ice
    };
    return backgrounds[cellNum] || '';
  };

  const getTokenColor = (cellNum: CellNumber): string => {
    const colors: Record<CellNumber, string> = {
      [CellNumber.FIVE]: '#4CAF50', // Green
      [CellNumber.SIX]: '#FF9800', // Orange
      [CellNumber.SEVEN]: '#F44336', // Red
      [CellNumber.EIGHT]: '#9E9E9E', // Grey
      [CellNumber.NINE]: '#03A9F4', // Blue
      [CellNumber.TEN]: '#81D4FA', // Lighter blue
    };
    return colors[cellNum] || '#fff';
  };

  const getPlayerColor = (color: PlayerColor): string => {
    const colors: Record<PlayerColor, string> = {
      [PlayerColor.BLACK]: '#212121',
      [PlayerColor.WHITE]: '#F5F5F5',
      [PlayerColor.RED]: '#F44336',
      [PlayerColor.YELLOW]: '#FFEB3B',
      [PlayerColor.GREEN]: '#437b54',
    };
    return colors[color] || '#fff';
  };

  return (
    <section
      className={`mountain-column ${isValidTarget ? 'valid-target' : ''}`}
      aria-label={`${i18n.t('ariaMountain')} ${cellNumber}`}
    >
      {/* Point tokens above - circular token showing count */}
      <div className="point-token-stack">
        <div
          className={`point-token ${isValidTarget ? 'valid-target-token' : ''}`}
          style={{ backgroundColor: getTokenColor(cellNumber) }}
          role="img"
          aria-label={`${i18n.t('ariaToken')} ${cellNumber}, ${tokenCount} ${i18n.t('available')}${isValidTarget && selectedSum > 0 ? `, ${i18n.t('validTarget')}` : ''}`}
        >
          <div className="token-value" aria-hidden="true">
            {cellNumber}
          </div>
          <div className="token-count" aria-hidden="true">
            x{tokenCount}
          </div>
          {isValidTarget && selectedSum > 0 && (
            <div className="valid-target-indicator" aria-hidden="true">
              ✓
            </div>
          )}
        </div>
      </div>

      {/* Mountain cards */}
      <ol className="mountain-cards">
        {cells.map((cell, index) => {
          // Level number: top cell (index 0) is level 1, next is level 2, etc.
          const levelNumber = index + 1;

          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: Cells are fixed slots on the mountain.
              key={index}
              className={`mountain-card ${getMountainBackground(cellNumber)} ${cell.isTop ? 'card-top' : ''} ${cell.occupiedBy.length > 0 ? `occupied` : ''}`}
              aria-label={`${i18n.t('ariaMountain')} ${cellNumber}, level ${levelNumber}${cell.occupiedBy.length > 0 ? `, ${i18n.t('occupiedBy')} ${cell.occupiedBy.join(', ')}` : ''}`}
            >
              <div className="card-number-circle" aria-hidden="true">
                {cellNumber}
              </div>
              {cell.occupiedBy.length > 0 && (
                <div className="player-markers-container">
                  {cell.occupiedBy.map((playerColor) => {
                    const isCurrentPlayer = playerColor === currentPlayer.color;
                    const canMove = isCurrentPlayer && isValidTarget && selectedSum > 0;
                    const className = `player-marker ${canMove ? 'clickable valid-target-glow' : ''} ${isCurrentPlayer ? 'current-player current-player-glow' : ''}`;
                    const style = { backgroundColor: getPlayerColor(playerColor) };
                    // A player has at most one goat on a mountain, so the colour is a stable key.
                    return canMove ? (
                      <button
                        key={playerColor}
                        data-goat={`${playerColor}@${cellNumber}`}
                        data-step={levelNumber}
                        type="button"
                        className={className}
                        style={style}
                        onClick={handleGoatClick}
                        aria-label={`${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${currentPlayer.name}, ${i18n.t('clickGoatToMove')} ${cellNumber}`}
                        title={`${i18n.t('clickGoatToMove')} ${cellNumber}`}
                      />
                    ) : (
                      <span
                        key={playerColor}
                        data-goat={`${playerColor}@${cellNumber}`}
                        data-step={levelNumber}
                        className={className}
                        style={style}
                        role="img"
                        aria-label={`${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${playerColor}`}
                      />
                    );
                  })}
                </div>
              )}
              <div className="level-subscript" aria-hidden="true">
                {levelNumber}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Player pieces (goats) below */}
      <div className="goat-tokens">
        {pieces.map((color) => {
          const isCurrentPlayer = color === currentPlayer.color;
          const canMove = isCurrentPlayer && isValidTarget && selectedSum > 0 && hasPlayerGoat;
          const className = `goat-token ${canMove ? 'clickable valid-target-glow' : ''} ${isCurrentPlayer ? 'current-player-goat current-player-glow' : ''}`;
          const style = {
            backgroundColor: getPlayerColor(color),
            borderColor: getPlayerColor(color),
          };
          // A player has at most one goat at the foot of a mountain, so the colour is a stable key.
          return canMove ? (
            <button
              key={color}
              data-goat={`${color}@${cellNumber}`}
              data-step="foot"
              type="button"
              className={className}
              style={style}
              onClick={handleGoatClick}
              aria-label={`${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${currentPlayer.name}, ${i18n.t('clickGoatToMove')} ${cellNumber}`}
              title={`${i18n.t('clickGoatToMove')} ${cellNumber} (${i18n.t('selectedSum')}: ${selectedSum})`}
            >
              🐐
            </button>
          ) : (
            <span
              key={color}
              data-goat={`${color}@${cellNumber}`}
              data-step="foot"
              className={className}
              style={style}
              role="img"
              aria-label={`${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${color}`}
              title={
                isValidTarget && selectedSum > 0 && isCurrentPlayer
                  ? 'No goat on this mountain'
                  : ''
              }
            >
              🐐
            </span>
          );
        })}
      </div>
    </section>
  );
};

export default MountainColumn;
