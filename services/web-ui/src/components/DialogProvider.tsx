import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  icon?: string;
}

interface DialogState {
  message: string;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  icon: string;
}

interface DialogContextValue {
  confirm: (message: string, opts?: ConfirmOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((message: string, {
    title = 'Confirm', confirmLabel = 'Confirm',
    cancelLabel = 'Cancel', confirmVariant = 'danger', icon = '⚠️',
  }: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ message, title, confirmLabel, cancelLabel, confirmVariant, icon });
    });
  }, []);

  const handleConfirm = () => { setDialog(null); resolveRef.current?.(true); };
  const handleCancel = () => { setDialog(null); resolveRef.current?.(false); };

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      <Modal
        isOpen={!!dialog} onClose={handleCancel}
        title={dialog?.title || 'Confirm'} variant="confirm"
        icon={dialog?.icon} confirmLabel={dialog?.confirmLabel || 'Confirm'}
        confirmVariant={dialog?.confirmVariant || 'danger'}
        cancelLabel={dialog?.cancelLabel || 'Cancel'} onConfirm={handleConfirm}
      >
        {dialog?.message}
      </Modal>
    </DialogContext.Provider>
  );
}

export const useDialog = () => useContext(DialogContext) as DialogContextValue;
export default DialogProvider;
