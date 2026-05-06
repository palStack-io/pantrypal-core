import { useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getColors, borderRadius, spacing } from '../colors';
import { useTheme } from '../context/ThemeContext';
import { getEmojiForCategory } from '../defaults';
import type { Item } from '../types';

interface Props {
  item: Item;
  onClose: () => void;
}

interface QRPayload {
  v: number;
  id: number | string;
  n: string;
  c: string;
  b?: string;
}

export function QRLabelModal({ item, onClose }: Props) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);
  const labelRef = useRef<HTMLDivElement>(null);

  const payload: QRPayload = {
    v: 1,
    id: item.id,
    n: item.name,
    c: item.category ?? 'Uncategorized',
    ...(item.brand ? { b: item.brand } : {}),
  };
  const qrValue = JSON.stringify(payload);

  const handleDownload = useCallback(() => {
    const svg = labelRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const size = 320;
    canvas.width = size;
    canvas.height = size + 80;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#6b7280';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${getEmojiForCategory(item.category ?? '')} ${item.category ?? 'Uncategorized'}`,
      canvas.width / 2,
      28
    );

    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(item.name, canvas.width / 2, 52, canvas.width - 20);

    if (item.brand) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(item.brand, canvas.width / 2, 70);
    }

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const qrSize = 200;
      const qrX = (canvas.width - qrSize) / 2;
      ctx.drawImage(img, qrX, 80, qrSize, qrSize);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('pantryPal', canvas.width / 2, canvas.height - 10);

      const link = document.createElement('a');
      link.download = `qr-${item.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [item]);

  const handlePrint = useCallback(() => {
    const svg = labelRef.current?.querySelector('svg');
    if (!svg) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const doc = printWindow.document;
    const style = doc.createElement('style');
    style.textContent = [
      'body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: system-ui, sans-serif; }',
      '.label { text-align: center; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; display: inline-block; }',
      '.cat { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }',
      '.name { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }',
      '.brand { font-size: 13px; color: #6b7280; margin-bottom: 16px; }',
      '.footer { font-size: 11px; color: #9ca3af; margin-top: 12px; letter-spacing: 1px; }',
    ].join('');
    doc.head.appendChild(style);
    doc.title = `QR Label — ${item.name}`;

    const body = doc.body;
    const label = doc.createElement('div');
    label.className = 'label';

    const cat = doc.createElement('div');
    cat.className = 'cat';
    cat.textContent = `${getEmojiForCategory(item.category ?? '')} ${item.category ?? 'Uncategorized'}`;
    label.appendChild(cat);

    const name = doc.createElement('div');
    name.className = 'name';
    name.textContent = item.name;
    label.appendChild(name);

    if (item.brand) {
      const brand = doc.createElement('div');
      brand.className = 'brand';
      brand.textContent = item.brand;
      label.appendChild(brand);
    }

    const svgClone = svg.cloneNode(true) as SVGElement;
    label.appendChild(svgClone);

    const footer = doc.createElement('div');
    footer.className = 'footer';
    footer.textContent = 'pantryPal';
    label.appendChild(footer);

    body.appendChild(label);
    printWindow.print();
  }, [item]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.xl, maxWidth: 380, width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: colors.textPrimary }}>QR Label</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: colors.textSecondary }}>×</button>
        </div>

        <div
          ref={labelRef}
          style={{ background: 'linear-gradient(135deg, #ffffff, #f8f4ff)', borderRadius: borderRadius.lg, padding: '24px', textAlign: 'center', border: '1px solid #e5e7eb', marginBottom: spacing.lg }}
        >
          <div style={{ fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
            {getEmojiForCategory(item.category ?? '')} {item.category ?? 'Uncategorized'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#1a1a2e', marginBottom: '4px' }}>{item.name}</div>
          {item.brand && <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>{item.brand}</div>}
          <div style={{ display: 'inline-block', padding: '12px', background: 'rgba(255,255,255,0.9)', borderRadius: '10px', marginBottom: '12px' }}>
            <QRCodeSVG value={qrValue} size={160} fgColor="#1a1a2e" bgColor="transparent" />
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '1px' }}>pantryPal</div>
        </div>

        <p style={{ margin: `0 0 ${spacing.lg}`, fontSize: '13px', color: colors.textSecondary, textAlign: 'center', lineHeight: 1.5 }}>
          Stick this label on the container. Scan it next shopping trip to instantly add to your list.
        </p>

        <div style={{ display: 'flex', gap: spacing.sm }}>
          <button
            onClick={handleDownload}
            style={{ flex: 1, padding: '10px', backgroundColor: colors.primary, color: '#fff', border: 'none', borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
          >
            ⬇ Download PNG
          </button>
          <button
            onClick={handlePrint}
            style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', color: colors.primary, border: `1.5px solid ${colors.primary}`, borderRadius: borderRadius.md, cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
          >
            🖨️ Print
          </button>
        </div>
      </div>
    </div>
  );
}

export default QRLabelModal;
