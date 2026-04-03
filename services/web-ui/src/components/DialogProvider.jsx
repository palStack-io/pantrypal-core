import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Modal } from './Modal';
import { useDarkMode } from '../hooks/useDarkMode';

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const { isDark } = useDarkMode();
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((message, {
    title = 'Confirm',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'danger',
    icon = '⚠️',
  } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ message, title, confirmLabel, cancelLabel, confirmVariant, icon });
    });
  }, []);

  const handleConfirm = () => {
    setDialog(null);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setDialog(null);
    resolveRef.current?.(false);
  };

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      <Modal
        isOpen={!!dialog}
        onClose={handleCancel}
        title={dialog?.title || 'Confirm'}
        isDark={isDark}
        variant="confirm"
        icon={dialog?.icon}
        confirmLabel={dialog?.confirmLabel || 'Confirm'}
        confirmVariant={dialog?.confirmVariant || 'danger'}
        cancelLabel={dialog?.cancelLabel || 'Cancel'}
        onConfirm={handleConfirm}
      >
        {dialog?.message}
      </Modal>
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext);
export default DialogProvider;
