import React, { useMemo } from 'react';
import { GameEngine } from '../game';
import { i18n } from '../i18n';
import { CellNumber, PlayerColor } from '../models';
import './MountainColumn.css';

interface MountainColumnProps {
  gameEngine: GameEngine;
  cellNumber: CellNumber;
  forceUpdate?: () => void;
  updateTrigger?: number;
}

const MountainColumn: React.FC<MountainColumnProps> = ({
  gameEngine,
  cellNumber,
  forceUpdate,
  updateTrigger,
}) => {
  // Use useMemo to optimize derived state calculations
  // Include updateTrigger in dependencies so component re-renders when state changes
  const state = useMemo(() => gameEngine.state, [gameEngine, updateTrigger]);
  const cells = useMemo(() => state.cells[cellNumber], [state, cellNumber]);
  const currentPlayer = useMemo(() => gameEngine.getCurrentPlayer(), [gameEngine, updateTrigger]);
  const validTargets = useMemo(
    () => gameEngine.getValidMountainTargets(),
    [gameEngine, updateTrigger]
  );
  const isValidTarget = useMemo(
    () => validTargets.includes(cellNumber),
    [validTargets, cellNumber]
  );
  const selectedSum = useMemo(() => gameEngine.getSelectedDiceSum(), [gameEngine, updateTrigger]);

  // Get point tokens for this column
  const pointTokens = useMemo(
    () => state.pointTokens.filter((t) => t.available && t.value === cellNumber),
    [state.pointTokens, cellNumber, updateTrigger]
  );
  const tokenCount = useMemo(() => pointTokens.length, [pointTokens]);

  // Get player pieces at foot of this column
  const pieces = useMemo(
    () => state.playerPieces[cellNumber] || [],
    [state.playerPieces, cellNumber, updateTrigger]
  );

  // Find if current player has a goat on this mountain (in cells or at foot)
  const hasPlayerGoat = useMemo(() => {
    // Check if player has piece in cells
    const hasInCells = cells.some((cell) => cell.occupiedBy.includes(currentPlayer.color));
    // Check if player has piece at foot
    const hasAtFoot = pieces.includes(currentPlayer.color);
    return hasInCells || hasAtFoot;
  }, [cells, pieces, currentPlayer]);

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
            <div className="valid-target-indicator" aria-label={i18n.t('validTarget')}>
              ✓
            </div>
          )}
        </div>
      </div>

      {/* Mountain cards */}
      <div className="mountain-cards">
        {cells.map((cell, index) => {
          // Level number: top cell (index 0) is level 1, next is level 2, etc.
          const levelNumber = index + 1;

          return (
            <div
              key={index}
              className={`mountain-card ${getMountainBackground(cellNumber)} ${cell.isTop ? 'card-top' : ''} ${cell.occupiedBy.length > 0 ? `occupied` : ''}`}
              role="gridcell"
              aria-label={`${i18n.t('ariaMountain')} ${cellNumber}, level ${levelNumber}${cell.occupiedBy.length > 0 ? `, ${i18n.t('occupiedBy')} ${cell.occupiedBy.join(', ')}` : ''}`}
            >
              <div className="card-number-circle" aria-hidden="true">
                {cellNumber}
              </div>
              {cell.occupiedBy.length > 0 && (
                <div className="player-markers-container">
                  {cell.occupiedBy.map((playerColor, markerIdx) => {
                    const isCurrentPlayer = playerColor === currentPlayer.color;
                    const canMove = isCurrentPlayer && isValidTarget && selectedSum > 0;
                    return (
                      <div
                        key={markerIdx}
                        className={`player-marker ${canMove ? 'clickable' : ''} ${isCurrentPlayer ? 'current-player' : ''} ${isCurrentPlayer ? 'current-player-glow' : ''} ${isCurrentPlayer && isValidTarget && selectedSum > 0 ? 'valid-target-glow' : ''}`}
                        style={{ backgroundColor: getPlayerColor(playerColor) }}
                        onClick={canMove ? handleGoatClick : undefined}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && canMove) {
                            e.preventDefault();
                            handleGoatClick();
                          }
                        }}
                        role={canMove ? 'button' : 'img'}
                        tabIndex={canMove ? 0 : -1}
                        aria-label={
                          canMove
                            ? `${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${currentPlayer.name}, ${i18n.t('clickGoatToMove')} ${cellNumber}`
                            : `${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${playerColor}`
                        }
                        title={canMove ? `${i18n.t('clickGoatToMove')} ${cellNumber}` : ''}
                      />
                    );
                  })}
                </div>
              )}
              <div className="level-subscript" aria-hidden="true">
                {levelNumber}
              </div>
            </div>
          );
        })}
      </div>

      {/* Player pieces (goats) below */}
      <div className="goat-tokens">
        {pieces.map((color, idx) => {
          const isCurrentPlayer = color === currentPlayer.color;
          const canMove = isCurrentPlayer && isValidTarget && selectedSum > 0 && hasPlayerGoat;

          return (
            <div
              key={idx}
              className={`goat-token ${canMove ? 'clickable' : ''} ${isCurrentPlayer ? 'current-player-goat' : ''} ${isCurrentPlayer ? 'current-player-glow' : ''} ${isCurrentPlayer && isValidTarget && selectedSum > 0 ? 'valid-target-glow' : ''}`}
              style={{
                backgroundColor: getPlayerColor(color),
                borderColor: getPlayerColor(color),
              }}
              onClick={
                isCurrentPlayer && isValidTarget && selectedSum > 0 ? handleGoatClick : undefined
              }
              onKeyDown={(e) => {
                if (
                  (e.key === 'Enter' || e.key === ' ') &&
                  isCurrentPlayer &&
                  isValidTarget &&
                  selectedSum > 0
                ) {
                  e.preventDefault();
                  handleGoatClick();
                }
              }}
              role={canMove ? 'button' : 'img'}
              tabIndex={canMove ? 0 : -1}
              aria-label={
                canMove
                  ? `${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${currentPlayer.name}, ${i18n.t('clickGoatToMove')} ${cellNumber}`
                  : `${i18n.t('ariaGoat')} ${i18n.t('ariaPlayer')} ${color}`
              }
              aria-pressed={canMove ? false : undefined}
              title={
                canMove
                  ? `${i18n.t('clickGoatToMove')} ${cellNumber} (${i18n.t('selectedSum')}: ${selectedSum})`
                  : isValidTarget && selectedSum > 0 && !hasPlayerGoat
                    ? `No goat on this mountain`
                    : ''
              }
            >
              🐐
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MountainColumn;
