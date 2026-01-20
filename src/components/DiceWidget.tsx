import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game';
import { i18n } from '../i18n';
import './DiceWidget.css';

interface DiceWidgetProps {
  gameEngine: GameEngine;
  forceUpdate?: () => void;
}

const DiceWidget: React.FC<DiceWidgetProps> = ({ gameEngine, forceUpdate }) => {
  const [_updateTrigger, setUpdateTrigger] = useState(0);
  const [changingDie, setChangingDie] = useState<number | null>(null);
  const [diceChanged, setDiceChanged] = useState(false);
  const prevCanChangeKeyRef = useRef<string>('');

  // Force local update
  const localUpdate = () => setUpdateTrigger((v) => v + 1);

  // Get current dice state
  const dice = gameEngine.state.dice;

  // Create a stable key for canChange state
  // Compute directly - the guard in useEffect will prevent unnecessary runs
  const canChangeKey = dice.map((d) => (d.canChange ? '1' : '0')).join('');

  // Listen for dice roll events to trigger sound and reset dice changed indicator
  useEffect(() => {
    // Play dice roll sound (softer, rounder)
    const playRollSound = () => {
      // Check if AudioContext is available (not available in test environments like jsdom)
      const AudioContextClass =
        globalThis.AudioContext ||
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass || typeof AudioContextClass !== 'function') {
        return; // Skip sound in test environments
      }

      try {
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Use a triangle wave for a softer sound
        oscillator.frequency.value = 300;
        oscillator.type = 'triangle';

        // Lower initial gain for softer volume
        gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.005, audioContext.currentTime + 0.25);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.25);
      } catch {
        // Silently fail in test environments where AudioContext may not be available
      }
    };

    const handleDiceRoll = () => {
      // Only play sound if not muted
      if (!gameEngine.state.soundMuted) {
        playRollSound();
      }
      // Reset dice changed indicator when dice are rolled
      setDiceChanged(false);
    };

    globalThis.addEventListener('diceRolled', handleDiceRoll);
    return () => globalThis.removeEventListener('diceRolled', handleDiceRoll);
  }, [gameEngine]);

  // Automatically show change controls when multiple 1s are rolled
  // Only update when canChange state actually changes
  useEffect(() => {
    // Only proceed if canChange state has actually changed
    if (canChangeKey === prevCanChangeKeyRef.current) {
      return;
    }

    // Update the ref immediately to prevent re-entry
    prevCanChangeKeyRef.current = canChangeKey;

    // Find the first changeable die index from the key
    const changeableDiceIndex = canChangeKey.indexOf('1');

    // Use functional update to avoid dependency on changingDie
    setChangingDie((currentChangingDie) => {
      if (changeableDiceIndex === -1) {
        // No more changeable dice, close edit mode
        return null;
      }

      // If no die is being changed, automatically open edit mode for the first changeable die
      if (currentChangingDie === null) {
        return changeableDiceIndex;
      }

      // Check if current die is still changeable by checking the key
      const currentDieCanChange = canChangeKey[currentChangingDie] === '1';
      if (currentDieCanChange) {
        // Keep current die if it's still changeable
        return currentChangingDie;
      }

      // Current die is no longer changeable, switch to the first changeable one
      return changeableDiceIndex;
    });
  }, [canChangeKey]);

  const handleDieClick = (index: number) => {
    const die = dice[index];

    if (die.canChange) {
      setChangingDie(index);
    } else if (!die.used && !die.locked) {
      // Toggle selection for unused, unlocked dice
      gameEngine.toggleDieSelection(index);

      // Force update to reflect selection change
      localUpdate();
      if (forceUpdate) {
        forceUpdate();
      }
    }
  };

  const changeDieValue = (newValue: number) => {
    if (changingDie !== null) {
      gameEngine.changeDieValue(changingDie, newValue);
      setChangingDie(null);
      setDiceChanged(true); // Mark that dice have been changed
      localUpdate();
      if (forceUpdate) {
        forceUpdate();
      }
    }
  };

  const getDieDots = (value: number): number[][] => {
    // Return dot positions for each die face (1-6)
    const patterns: Record<number, number[][]> = {
      1: [[1, 1]], // center
      2: [
        [0, 0],
        [2, 2],
      ], // diagonal
      3: [
        [0, 0],
        [1, 1],
        [2, 2],
      ], // diagonal
      4: [
        [0, 0],
        [0, 2],
        [2, 0],
        [2, 2],
      ], // corners
      5: [
        [0, 0],
        [0, 2],
        [1, 1],
        [2, 0],
        [2, 2],
      ], // corners + center
      6: [
        [0, 0],
        [0, 1],
        [0, 2],
        [2, 0],
        [2, 1],
        [2, 2],
      ], // two columns
    };
    return patterns[value] || [];
  };

  const hasUnchangedOnes = dice.some((d) => d.canChange);

  return (
    <div className="dice-widget">
      <h3 style={{ position: 'relative' }}>
        Dice
        {diceChanged && <span className="dice-changed-indicator">*</span>}
      </h3>
      {hasUnchangedOnes && (
        <div className="change-dice-notice">
          Multiple 1s rolled! Select a value (2-6) to change it.
        </div>
      )}
      <div className="dice-container">
        {dice.map((die, index) => {
          const isChanging = changingDie === index;
          const isClickable = !die.used && !die.locked;

          // Build class names
          const dieClasses = [
            'die',
            die.locked ? 'locked' : '',
            die.canChange ? 'can-change' : '',
            isChanging ? 'changing' : '',
            die.selected ? 'selected' : '',
            die.used ? 'used' : '',
            isClickable ? '' : 'not-clickable',
          ]
            .filter(Boolean)
            .join(' ');

          // Build aria label
          const ariaLabelParts = [
            `${i18n.t('ariaDie')} ${index + 1}`,
            `${i18n.t('value')} ${die.value}`,
            die.selected ? i18n.t('ariaSelected') : '',
            die.used ? i18n.t('ariaUsed') : '',
            die.locked ? i18n.t('ariaLocked') : '',
            die.canChange ? i18n.t('ariaCanChange') : '',
          ]
            .filter(Boolean)
            .join(', ');

          // Build title
          let dieTitle = i18n.t('clickToSelect');
          if (die.used) {
            dieTitle = i18n.t('dieUsed');
          } else if (die.locked) {
            dieTitle = i18n.t('dieLocked');
          } else if (die.canChange) {
            dieTitle = i18n.t('clickToChange');
          }

          return (
            <div
              key={`die-${index}-v${die.value}`}
              style={{ position: 'relative', marginBottom: isChanging ? '4rem' : '0' }}
            >
              <button
                type="button"
                className={dieClasses}
                onClick={() => handleDieClick(index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDieClick(index);
                  }
                }}
                tabIndex={isClickable || die.canChange ? 0 : -1}
                aria-label={ariaLabelParts}
                aria-pressed={die.selected}
                disabled={!isClickable && !die.canChange}
                style={{ cursor: isClickable || die.canChange ? 'pointer' : 'not-allowed' }}
                title={dieTitle}
              >
                <div className="die-face">
                  {getDieDots(die.value).map(([row, col]) => (
                    <div
                      key={`dot-${row}-${col}`}
                      className="die-dot"
                      style={{
                        gridRow: row + 1,
                        gridColumn: col + 1,
                      }}
                    />
                  ))}
                </div>
                <div className="die-status">{die.canChange ? '✏️' : ''}</div>
              </button>
              {isChanging && (
                <div
                  className="change-die-controls"
                  role="radiogroup"
                  aria-label={i18n.t('clickToChange')}
                >
                  {[2, 3, 4, 5, 6].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="change-value-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        changeDieValue(value);
                      }}
                      aria-label={`${i18n.t('changedDie')} ${value}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiceWidget;
