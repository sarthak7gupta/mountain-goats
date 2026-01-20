import React, { useEffect, useRef } from 'react';
import { i18n } from '../i18n';
import './HelpModal.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 0);
    } else {
      // Return focus to the previously focused element when modal closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Trap focus within modal
  useEffect(() => {
    if (!isOpen) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
        // Cmd+/ or Ctrl+/ to toggle modal
        if ((e.metaKey || e.ctrlKey) && e.key === '/') {
          e.preventDefault();
          onClose();
        }
        // H to toggle help
        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // Handle Escape key to close modal
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
          }
          // Stop propagation for other keys to prevent global handlers
          e.stopPropagation();
        }}
        role="document"
      >
        <div className="modal-header">
          <h2 id="help-modal-title">
            🏔️ {i18n.t('gameTitle')} - {i18n.t('gameRules')}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label={i18n.t('closeModal')}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <section className="rule-section">
            <h3>{i18n.t('objective')}</h3>
            <p>{i18n.t('objectiveText')}</p>
          </section>

          <section className="rule-section">
            <h3>{i18n.t('setup')}</h3>
            <ul>
              {i18n.getArray('setupItems').map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="rule-section">
            <h3>{i18n.t('turnStructure')}</h3>
            <ol>
              {i18n.getArray('turnSteps').map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </section>

          <section className="rule-section">
            <h3>{i18n.t('specialRules')}</h3>
            <ul>
              {i18n.getArray('specialRulesItems').map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="rule-section">
            <h3>{i18n.t('bonusTokens')}</h3>
            <p>{i18n.t('bonusTokensText')}</p>
          </section>

          <section className="rule-section">
            <h3>{i18n.t('gameEnd')}</h3>
            <p>{i18n.t('gameEndText')}</p>
            <ul>
              {i18n.getArray('gameEndItems').map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <p>{i18n.t('gameEndContinue')}</p>
          </section>

          <section className="rule-section">
            <h3>{i18n.t('winning')}</h3>
            <p>{i18n.t('winningText')}</p>
            <ul>
              {i18n.getArray('winningTieBreakers').map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="close-button-large"
            onClick={onClose}
            aria-label={i18n.t('gotIt')}
          >
            {i18n.t('gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
