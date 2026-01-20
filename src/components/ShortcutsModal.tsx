import React, { useEffect, useRef } from 'react';
import { i18n } from '../i18n';
import './ShortcutsModal.css';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
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
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
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
          <h2 id="shortcuts-modal-title">⌨️ {i18n.t('keyboardShortcuts')}</h2>
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
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>Cmd</kbd> + <kbd>/</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('openShortcuts')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>M</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('toggleSound')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>Esc</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('closeModal')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>N</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('nextTurnShortcut')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('resetGameShortcut')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>H</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('help')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>1</kbd> - <kbd>6</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('changeOrSelectDiceShortcut')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>C</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('clearDiceSelectionShortcut')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>Backspace</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('removeLastDieShortcut')}</span>
          </div>
          <div className="shortcut-item">
            <span className="shortcut-keys">
              <kbd>Enter</kbd>
            </span>
            <span className="shortcut-text">{i18n.t('moveGoatShortcut')}</span>
          </div>
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

export default ShortcutsModal;
