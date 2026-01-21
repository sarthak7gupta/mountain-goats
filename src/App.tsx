import { useCallback, useEffect, useRef, useState } from 'react';
import BonusTokens from './components/BonusTokens';
import ConfirmModal from './components/ConfirmModal';
import DiceWidget from './components/DiceWidget';
import GameLog from './components/GameLog';
import HelpModal from './components/HelpModal';
import MountainColumn from './components/MountainColumn';
import PlayerSetup from './components/PlayerSetup';
import PlayerSidebar from './components/PlayerSidebar';
import ShortcutsModal from './components/ShortcutsModal';
import WinScreen from './components/WinScreen';
import { GameEngine } from './game';
import { i18n } from './i18n';
import { CellNumber, PlayerColor } from './models';
import './App.css';

const STORAGE_KEY = 'mountain-goats-game-state';
const SESSION_FLAG = 'mountain-goats-session';
const PREFERENCES_KEY = 'mountain-goats-preferences';

interface HeaderButtonsProps {
  currentLanguage: string;
  currentSoundMuted: boolean;
  gameEngine: GameEngine | null;
  language: string;
  soundMuted: boolean;
  onLanguageClick: () => void;
  onSoundClick: () => void;
  onHelpClick: () => void;
}

// Header buttons component
const HeaderButtons: React.FC<HeaderButtonsProps> = ({
  currentLanguage,
  currentSoundMuted,
  gameEngine,
  language,
  soundMuted,
  onLanguageClick,
  onSoundClick,
  onHelpClick,
}) => (
  <div className="header-buttons">
    <button
      type="button"
      className="header-button language-button"
      onClick={onLanguageClick}
      aria-label={i18n.t('language')}
      title={i18n.t('language')}
      disabled
    >
      🌐 {currentLanguage?.toUpperCase() || 'EN'}
    </button>
    <button
      type="button"
      className="header-button sound-button"
      onClick={onSoundClick}
      aria-label={currentSoundMuted ? i18n.t('unmuteSound') : i18n.t('muteSound')}
      title={currentSoundMuted ? i18n.t('unmuteSound') : i18n.t('muteSound')}
    >
      {currentSoundMuted ? '🔇' : '🔊'}
    </button>
    <button
      type="button"
      className="header-button help-button"
      onClick={onHelpClick}
      aria-label={i18n.t('help')}
      aria-haspopup="dialog"
    >
      ❓ {i18n.t('help')}
    </button>
  </div>
);

function App() {
  const [gameEngine, setGameEngine] = useState<GameEngine | null>(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmNextTurn, setShowConfirmNextTurn] = useState(false);
  // Language and sound preferences (used when no game is active)
  const [language, setLanguage] = useState<string>('en');
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  const forceUpdate = () => setUpdateTrigger((v) => v + 1);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedPrefs = localStorage.getItem(PREFERENCES_KEY);
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        if (prefs.language) {
          setLanguage(prefs.language);
          i18n.setLocale(prefs.language as 'en');
        }
        if (prefs.soundMuted !== undefined) {
          setSoundMuted(prefs.soundMuted);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ language, soundMuted }));
  }, [language, soundMuted]);

  // Load game state from localStorage on mount
  useEffect(() => {
    const now = Date.now();
    const lastSessionTime = sessionStorage.getItem(SESSION_FLAG);
    const SESSION_TIMEOUT = 1000; // 1 second - if page was closed for longer, treat as hard refresh

    // Check if this is a hard refresh (session flag missing or too old)
    if (!lastSessionTime || now - Number.parseInt(lastSessionTime, 10) > SESSION_TIMEOUT) {
      // Hard refresh or first visit - clear localStorage
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem(SESSION_FLAG, now.toString());
    } else {
      // Normal refresh or page reopen - try to load saved state
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        try {
          const engine = GameEngine.deserialize(savedState);
          setGameEngine(engine);
          // Restore language preference
          if (engine.state.language) {
            setLanguage(engine.state.language);
            i18n.setLocale(engine.state.language as 'en');
          }
          if (engine.state.soundMuted !== undefined) {
            setSoundMuted(engine.state.soundMuted);
          }
          forceUpdate();
        } catch (_error) {
          console.error('Failed to load game state:', _error);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }

    // Update session timestamp on mount
    sessionStorage.setItem(SESSION_FLAG, now.toString());

    // Update session timestamp periodically to keep it fresh
    const interval = setInterval(() => {
      sessionStorage.setItem(SESSION_FLAG, Date.now().toString());
    }, 500);

    // Clean up interval on unmount
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Sync preferences from gameEngine to standalone state
  useEffect(() => {
    if (gameEngine) {
      if (gameEngine.state.language && gameEngine.state.language !== language) {
        setLanguage(gameEngine.state.language);
        i18n.setLocale(gameEngine.state.language as 'en');
      }
      if (gameEngine.state.soundMuted !== undefined && gameEngine.state.soundMuted !== soundMuted) {
        setSoundMuted(gameEngine.state.soundMuted);
      }
    }
  }, [gameEngine, updateTrigger, language, soundMuted]);

  // Save game state to localStorage whenever it changes
  // Use a ref to track the last saved state to avoid unnecessary saves
  const lastSavedStateRef = useRef<string>('');
  useEffect(() => {
    if (gameEngine) {
      try {
        const serialized = gameEngine.serialize();
        // Only save if the state actually changed
        if (serialized !== lastSavedStateRef.current) {
          localStorage.setItem(STORAGE_KEY, serialized);
          lastSavedStateRef.current = serialized;
        }
      } catch (_error) {
        console.error('Failed to save game state:', _error);
      }
    }
  }, [gameEngine, updateTrigger]);

  // Check if there are unused dice
  const hasUnusedDice = useCallback(() => {
    if (!gameEngine) return false;
    return gameEngine.state.dice.some((die) => !die.used && !die.locked);
  }, [gameEngine]);

  const requestNextTurn = useCallback(() => {
    if (!gameEngine) return;

    // Check if there are unused dice
    if (hasUnusedDice()) {
      setShowConfirmNextTurn(true);
    } else {
      // No unused dice, proceed directly
      gameEngine.nextTurn();
      forceUpdate();
    }
  }, [gameEngine, hasUnusedDice, forceUpdate]);

  const confirmNextTurn = useCallback(() => {
    if (gameEngine) {
      gameEngine.nextTurn();
      forceUpdate();
    }
    setShowConfirmNextTurn(false);
  }, [gameEngine, forceUpdate]);

  const nextTurn = requestNextTurn;

  const handleSoundClick = useCallback(() => {
    if (gameEngine) {
      gameEngine.toggleSoundMuted();
      forceUpdate();
    } else {
      setSoundMuted(!soundMuted);
    }
  }, [gameEngine, soundMuted, forceUpdate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // M to toggle sound
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleSoundClick();
        return;
      }

      // Don't handle shortcuts if a modal is open
      if (showHelp || showShortcuts || showConfirmReset || showConfirmNextTurn) {
        // Only allow Escape and modal-specific shortcuts when modals are open
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowHelp(false);
          setShowShortcuts(false);
          setShowConfirmReset(false);
          return;
        }
        // Block all other shortcuts when modals are open
        return;
      }

      // Cmd+/ or Ctrl+/ to toggle shortcuts modal
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Esc to close modals (works even when game is not active)
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowHelp(false);
        setShowShortcuts(false);
        setShowConfirmReset(false);
        return;
      }

      // H to open help (works even when game is not active)
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Cmd+Shift+R or Ctrl+Shift+R for reset and hard refresh
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        // Clear storage before browser does hard refresh
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(SESSION_FLAG);
        // Don't prevent default - let browser handle hard refresh
        return;
      }

      // Only handle game shortcuts when game is active
      if (!gameEngine) return;

      // N for next turn
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        nextTurn();
        return;
      }

      // 1-6 to change editable dice or select dice
      const numKey = Number.parseInt(e.key, 10);
      if (numKey >= 1 && numKey <= 6) {
        e.preventDefault();
        const editableDice = gameEngine.state.dice.findIndex((d) => d.canChange);
        if (editableDice >= 0) {
          // Change editable dice
          gameEngine.changeDieValue(editableDice, numKey);
          forceUpdate();
        } else {
          // Select first selectable dice with that value
          const selectableDie = gameEngine.state.dice.findIndex(
            (d) => d.value === numKey && !d.used && !d.locked && !d.selected
          );
          if (selectableDie >= 0) {
            gameEngine.toggleDieSelection(selectableDie);
            forceUpdate();
          }
        }
        return;
      }

      // C to clear dice selection
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        gameEngine.clearDiceSelection();
        forceUpdate();
        return;
      }

      // Backspace to remove last  die
      if (e.key === 'Backspace') {
        e.preventDefault();
        gameEngine.removeLastDie();
        forceUpdate();
        return;
      }

      // Enter to move goat on valid mountain
      if (e.key === 'Enter') {
        e.preventDefault();
        const validTargets = gameEngine.getValidMountainTargets();
        if (validTargets.length > 0) {
          const targetMountain = validTargets[0];
          const moved = gameEngine.moveGoatUpMountain(targetMountain);
          if (moved) {
            forceUpdate();
          }
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [
    gameEngine,
    showShortcuts,
    showHelp,
    showConfirmReset,
    showConfirmNextTurn,
    forceUpdate,
    nextTurn,
    handleSoundClick,
  ]);

  const handleStartGame = (playerNames: string[]) => {
    const engine = new GameEngine(playerNames.length, 10, 10, playerNames);
    // Apply saved preferences to the new game
    engine.setLanguage(language);
    if (soundMuted) {
      engine.toggleSoundMuted();
    }
    setGameEngine(engine);
    forceUpdate();
    // Auto-roll dice when game starts - delay to ensure component is mounted
    setTimeout(() => {
      engine.rollDice();
      forceUpdate();
    }, 100);
  };

  const requestReset = () => {
    setShowConfirmReset(true);
  };

  const confirmReset = () => {
    // Clear localStorage on reset
    localStorage.removeItem(STORAGE_KEY);
    setGameEngine(null);
    setShowConfirmReset(false);
  };

  // Helper to get current language (from gameEngine or standalone state)
  const currentLanguage = gameEngine?.state.language || language;
  const currentSoundMuted = gameEngine?.state.soundMuted ?? soundMuted;

  const handleLanguageClick = () => {
    // For now, only 'en' is available, but structure is ready for more languages
    const currentLang = currentLanguage || 'en';
    if (gameEngine) {
      gameEngine.setLanguage(currentLang);
      forceUpdate();
    } else {
      setLanguage(currentLang);
      i18n.setLocale(currentLang as 'en');
    }
  };

  // Generate gradient based on player color
  const getGradientForPlayer = (color: PlayerColor): string => {
    // Create lighter variations of each color for gradient
    const gradients: Record<PlayerColor, string> = {
      [PlayerColor.BLACK]: 'linear-gradient(135deg, #EEEEEE 0%, #B0BEC5 50%, #616161 100%)',
      [PlayerColor.WHITE]: 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 50%, #EEEEEE 100%)',
      [PlayerColor.RED]: 'linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 50%, #EF9A9A 100%)',
      [PlayerColor.YELLOW]: 'linear-gradient(135deg, #FFFDE7 0%, #FFF9C4 50%, #FFF59D 100%)',
    };
    return gradients[color] || 'linear-gradient(135deg, #E1F5FE 0%, #B3E5FC 50%, #81D4FA 100%)';
  };

  // Get background gradient style
  const getAppBackgroundStyle = (): React.CSSProperties => {
    if (gameEngine) {
      const currentPlayer = gameEngine.getCurrentPlayer();
      return {
        background: getGradientForPlayer(currentPlayer.color),
      };
    }
    // Default gradient when no game is active
    return {
      background: 'linear-gradient(135deg, #E1F5FE 0%, #B3E5FC 50%, #81D4FA 100%)',
    };
  };

  return (
    <>
      {gameEngine ? (
        <>
          {gameEngine.state.gameOver ? (
            <WinScreen gameEngine={gameEngine} onReset={confirmReset} />
          ) : (
            <div
              className="app"
              role="application"
              aria-label={i18n.t('gameTitle')}
              style={getAppBackgroundStyle()}
            >
              <header className="header">
                <h1>🏔️ {i18n.t('gameTitle')}</h1>
                <HeaderButtons
                  currentLanguage={currentLanguage}
                  currentSoundMuted={currentSoundMuted}
                  gameEngine={gameEngine}
                  language={language}
                  soundMuted={soundMuted}
                  onLanguageClick={handleLanguageClick}
                  onSoundClick={handleSoundClick}
                  onHelpClick={() => setShowHelp(true)}
                />
              </header>

              <div className="controls" role="toolbar" aria-label="Game controls">
                <button type="button" onClick={nextTurn} aria-label={i18n.t('nextTurn')}>
                  {i18n.t('nextTurn')}
                </button>
                <button
                  type="button"
                  onClick={requestReset}
                  className="reset-btn"
                  aria-label={i18n.t('reset')}
                >
                  {i18n.t('reset')}
                </button>
              </div>
              {gameEngine.state.gameEndTriggered &&
                (gameEngine.state.turnsSinceEndCondition || 0) === 0 && (
                  <div className="last-round-banner" role="alert" aria-live="polite">
                    <strong>{i18n.t('lastRound')}</strong>: {i18n.t('lastRoundBanner')}
                  </div>
                )}
              <main id="main-content" className="main-container">
                <div className="dice-panel">
                  <DiceWidget gameEngine={gameEngine} forceUpdate={forceUpdate} />
                </div>

                <div className="board-area">
                  <BonusTokens gameEngine={gameEngine} />

                  <div className="columns-container">
                    {Object.values(CellNumber)
                      .filter((v) => typeof v === 'number')
                      .map((cellNum) => (
                        <MountainColumn
                          key={cellNum}
                          gameEngine={gameEngine}
                          cellNumber={cellNum as CellNumber}
                          forceUpdate={forceUpdate}
                          updateTrigger={updateTrigger}
                        />
                      ))}
                  </div>
                </div>

                <div className="players-panel">
                  <PlayerSidebar gameEngine={gameEngine} />
                  <GameLog gameEngine={gameEngine} />
                </div>
              </main>
            </div>
          )}
        </>
      ) : (
        <div
          className="app"
          role="application"
          aria-label={i18n.t('gameTitle')}
          style={getAppBackgroundStyle()}
        >
          <header className="header">
            <h1>🏔️ {i18n.t('gameTitle')}</h1>
            <HeaderButtons
              currentLanguage={currentLanguage}
              currentSoundMuted={currentSoundMuted}
              gameEngine={gameEngine}
              language={language}
              soundMuted={soundMuted}
              onLanguageClick={handleLanguageClick}
              onSoundClick={handleSoundClick}
              onHelpClick={() => setShowHelp(true)}
            />
          </header>
          <PlayerSetup onStart={handleStartGame} />
        </div>
      )}
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <ConfirmModal
        isOpen={showConfirmReset}
        title={`${i18n.t('reset')} ${i18n.t('gameTitle')}?`}
        message={i18n.t('resetGameMessage')}
        confirmText={i18n.t('yesReset')}
        cancelText={i18n.t('cancel')}
        onConfirm={confirmReset}
        onCancel={() => setShowConfirmReset(false)}
      />
      <ConfirmModal
        isOpen={showConfirmNextTurn}
        title={i18n.t('passTurn')}
        message={i18n.t('passTurnMessage')}
        confirmText={i18n.t('yesPassTurn')}
        cancelText={i18n.t('cancel')}
        onConfirm={confirmNextTurn}
        onCancel={() => setShowConfirmNextTurn(false)}
      />
    </>
  );
}

export default App;
