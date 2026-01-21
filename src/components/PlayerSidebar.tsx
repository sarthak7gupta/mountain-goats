import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game';
import { i18n } from '../i18n';
import { PlayerColor } from '../models';
import './PlayerSidebar.css';

interface PlayerSidebarProps {
  gameEngine: GameEngine;
}

const PlayerSidebar: React.FC<PlayerSidebarProps> = ({ gameEngine }) => {
  const state = gameEngine.state;
  const currentPlayerIndex = state.currentPlayerIndex;
  const [animatingPlayers, setAnimatingPlayers] = useState<Set<number>>(new Set());
  const prevStateRef = useRef<{
    scores: number[];
    tokenCounts: Record<number, Record<number, number>>;
    bonusTokenCounts: Record<number, number>;
  }>({ scores: [], tokenCounts: {}, bonusTokenCounts: {} });

  const getPlayerColor = (color: PlayerColor): string => {
    const colors: Record<PlayerColor, string> = {
      [PlayerColor.BLACK]: '#212121',
      [PlayerColor.WHITE]: '#F5F5F5',
      [PlayerColor.RED]: '#F44336',
      [PlayerColor.YELLOW]: '#FFEB3B',
    };
    return colors[color] || '#fff';
  };

  const getPointTokensForPlayer = (playerIndex: number): Record<number, number> => {
    // Count tokens claimed by this player
    const tokens: Record<number, number> = {};
    for (let i = 5; i <= 10; i++) {
      tokens[i] = 0;
    }

    // Count tokens claimed by this specific player
    state.pointTokens.forEach((token) => {
      if (!token.available && token.claimedBy === playerIndex) {
        tokens[token.value] = (tokens[token.value] || 0) + 1;
      }
    });

    return tokens;
  };

  const getBonusTokensForPlayer = (playerIndex: number): number[] => {
    return state.bonusTokens
      .filter((token) => !token.available && token.claimedBy === playerIndex)
      .map((token) => token.value)
      .sort((a, b) => b - a); // Sort descending
  };

  // Detect token claims and trigger animations
  useEffect(() => {
    const currentScores = state.players.map((p) => p.score);
    const currentTokenCounts: Record<number, Record<number, number>> = {};
    const currentBonusTokenCounts: Record<number, number> = {};

    // Calculate token counts for each player
    state.players.forEach((_, index) => {
      // Count point tokens
      const tokens: Record<number, number> = {};
      for (let i = 5; i <= 10; i++) {
        tokens[i] = 0;
      }
      state.pointTokens.forEach((token) => {
        if (!token.available && token.claimedBy === index) {
          tokens[token.value] = (tokens[token.value] || 0) + 1;
        }
      });
      currentTokenCounts[index] = tokens;

      // Count bonus tokens
      const bonusCount = state.bonusTokens.filter(
        (token) => !token.available && token.claimedBy === index
      ).length;
      currentBonusTokenCounts[index] = bonusCount;
    });

    const prevState = prevStateRef.current;
    const playersToAnimate = new Set<number>();

    // Check each player for token claims
    state.players.forEach((player, index) => {
      const prevScore = prevState.scores[index] || 0;
      const currentScore = currentScores[index] || 0;

      // Check if score increased (token was claimed)
      if (currentScore > prevScore) {
        playersToAnimate.add(index);
      }

      // Check if token count increased
      const prevTokenCount = Object.values(prevState.tokenCounts[index] || {}).reduce(
        (sum, count) => sum + count,
        0
      );
      const currentTokenCount = Object.values(currentTokenCounts[index] || {}).reduce(
        (sum, count) => sum + count,
        0
      );

      if (currentTokenCount > prevTokenCount) {
        playersToAnimate.add(index);
      }

      // Check if bonus token count increased
      const prevBonusCount = prevState.bonusTokenCounts[index] || 0;
      const currentBonusCount = currentBonusTokenCounts[index] || 0;

      if (currentBonusCount > prevBonusCount) {
        playersToAnimate.add(index);
      }
    });

    // Trigger animations for players who claimed tokens
    if (playersToAnimate.size > 0) {
      setAnimatingPlayers(playersToAnimate);

      // Remove animation class after animation completes
      const timeout = setTimeout(() => {
        setAnimatingPlayers(new Set());
      }, 600); // Match animation duration

      return () => clearTimeout(timeout);
    }

    // Update previous state
    prevStateRef.current = {
      scores: currentScores,
      tokenCounts: currentTokenCounts,
      bonusTokenCounts: currentBonusTokenCounts,
    };
  }, [state.players, state.pointTokens, state.bonusTokens]);

  return (
    <aside className="player-sidebar" aria-label={i18n.t('players')}>
      {state.players.map((player, index) => {
        const isActive = index === currentPlayerIndex;
        const tokens = getPointTokensForPlayer(index);
        const bonusTokens = getBonusTokensForPlayer(index);

        return (
          <article
            key={index}
            className={`player-card ${isActive ? 'active' : 'inactive'} ${
              animatingPlayers.has(index) ? 'token-claimed' : ''
            }`}
            aria-label={`${i18n.t('ariaPlayer')} ${player.name}, ${i18n.t('score')} ${player.score}${isActive ? `, ${i18n.t('ariaCurrentPlayer')}` : ''}`}
          >
            <div className="player-header">
              <div
                className="player-color-indicator"
                style={{ backgroundColor: getPlayerColor(player.color) }}
                role="img"
                aria-label={`${i18n.t('ariaPlayer')} color: ${player.color}`}
              />
              <div className="player-info">
                <div className="player-name">
                  {player.name}
                  {state.gameEndTriggered &&
                    (state.turnsSinceEndCondition || 0) === 0 &&
                    state.playersPlayedInLastRound?.includes(index) && (
                      <span className="last-round-indicator" aria-label="Played last turn">
                        *
                      </span>
                    )}
                </div>
                <div className="player-score">
                  {i18n.t('score')}: <strong>{player.score}</strong>
                </div>
              </div>
            </div>

            <div className="player-tokens">
              {[5, 6, 7, 8, 9, 10].map((value) => (
                <div key={value} className="token-item">
                  <div className="token-circle" style={{ backgroundColor: getTokenColor(value) }}>
                    {value}
                  </div>
                  <span className="token-count">x {tokens[value] || 0}</span>
                </div>
              ))}
            </div>

            {bonusTokens.length > 0 && (
              <div className="player-bonus-tokens">
                <div className="bonus-tokens-label">{i18n.t('bonusTokens')}:</div>
                <div className="bonus-tokens-list">
                  {bonusTokens.map((value, idx) => (
                    <div key={idx} className="bonus-token-badge">
                      {value}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </aside>
  );
};

const getTokenColor = (value: number): string => {
  const colors: Record<number, string> = {
    5: '#4CAF50',
    6: '#FF9800',
    7: '#F44336',
    8: '#9E9E9E',
    9: '#03A9F4',
    10: '#03A9F4',
  };
  return colors[value] || '#fff';
};

export default PlayerSidebar;
