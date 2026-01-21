import React from 'react';
import { GameEngine } from '../game';
import { i18n } from '../i18n';
import './BonusTokens.css';

interface BonusTokensProps {
  gameEngine: GameEngine;
}

const BonusTokens: React.FC<BonusTokensProps> = ({ gameEngine }) => {
  const tokens = gameEngine.state.bonusTokens.filter((t) => t.available);

  return (
    <section className="bonus-tokens-container" aria-label={i18n.t('bonusTokens')}>
      <div className="bonus-tokens-label">{i18n.t('bonusTokens')}</div>
      <div className="bonus-tokens">
        {tokens.length === 0 ? (
          <div className="no-tokens">No bonus tokens available</div>
        ) : (
          tokens
            .toSorted((a, b) => b.value - a.value)
            .map((token) => (
              <div
                key={token.value}
                className="bonus-token"
                role="img"
                aria-label={`${i18n.t('bonusToken')} ${token.value} ${i18n.t('points')}`}
              >
                <div className="bonus-token-background" aria-hidden="true"></div>
                <div className="bonus-token-value" aria-hidden="true">
                  {token.value}
                </div>
              </div>
            ))
        )}
      </div>
    </section>
  );
};

export default BonusTokens;
