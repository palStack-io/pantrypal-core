import { useState } from 'react';
import { Modal } from '../Modal';
import Button from '../Button';
import { useTheme } from '../../context/ThemeContext';
import { getColors, spacing, borderRadius } from '../../colors';
import { downloadMealPlanIcs } from '../../api';
import { useToast } from '../Toast';

interface Range { start: string; end: string }

interface Props {
  open: boolean;
  week: Range;
  month: Range;
  onClose: () => void;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportModal({ open, week, month, onClose }: Props) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const download = async (range: Range) => {
    setBusy(true);
    try {
      saveBlob(await downloadMealPlanIcs(range.start, range.end), `meal-plan-${range.start}.ics`);
    } catch {
      toast.error("Couldn't create the file");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add to your calendar" width="520px">
      <section style={{ padding: spacing.md, borderRadius: borderRadius.xl, background: colors.card, border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', color: colors.textPrimary }}>Download a copy</h3>
        <p style={{ margin: 0, fontSize: '13px', color: colors.textSecondary, lineHeight: 1.45 }}>
          A one-time .ics file you can open in Apple Calendar, Google Calendar, Outlook or any calendar app.
          It won't update if you change the plan later.
        </p>
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={busy} onClick={() => void download(week)}>This week · Download .ics</Button>
          <Button variant="secondary" disabled={busy} onClick={() => void download(month)}>This month · Download .ics</Button>
        </div>
      </section>
    </Modal>
  );
}
