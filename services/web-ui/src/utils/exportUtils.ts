import type { Item } from '../types';

export interface ImportedItem {
  name: string;
  barcode: string | null;
  quantity: number;
  location: string | null;
  category: string | null;
  expiry_date: string | null;
  notes: string | null;
}

export interface ImportValidationResult {
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

export function exportToCSV(items: Item[], filename = 'pantry_items.csv'): void {
  if (!items || items.length === 0) return;

  const headers = ['Name', 'Barcode', 'Quantity', 'Location', 'Category', 'Expiry Date', 'Added Date', 'Notes'];
  const rows = items.map(item => [
    escapeCSV(item.name || ''),
    escapeCSV(item.barcode || ''),
    item.quantity || 1,
    escapeCSV(item.location || ''),
    escapeCSV(item.category || ''),
    item.expiry_date || '',
    item.created_at || '',
    escapeCSV(item.notes || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeCSV(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function parseCSV(csvText: string): ImportedItem[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV file is empty or invalid');

  const headers = parseCSVLine(lines[0]);
  const headerMap: Record<string, string[]> = {
    name: ['name', 'item', 'product', 'item name'],
    barcode: ['barcode', 'upc', 'ean', 'code'],
    quantity: ['quantity', 'qty', 'amount', 'count'],
    location: ['location', 'place', 'where', 'storage'],
    category: ['category', 'type', 'cat', 'group'],
    expiry_date: ['expiry date', 'expiry', 'exp date', 'expires', 'expiration'],
    notes: ['notes', 'note', 'description', 'desc', 'comments'],
  };

  const columnIndices: Record<string, number> = {};
  for (const [key, variations] of Object.entries(headerMap)) {
    const index = headers.findIndex(h => variations.includes(h.toLowerCase().trim()));
    if (index !== -1) columnIndices[key] = index;
  }

  if (columnIndices.name === undefined) throw new Error('CSV must contain a "Name" column');

  const items: ImportedItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v)) continue;
    const item: ImportedItem = {
      name: values[columnIndices.name] || '',
      barcode: columnIndices.barcode !== undefined ? values[columnIndices.barcode] || null : null,
      quantity: parseInt(columnIndices.quantity !== undefined ? values[columnIndices.quantity] : '') || 1,
      location: columnIndices.location !== undefined ? values[columnIndices.location] || null : null,
      category: columnIndices.category !== undefined ? values[columnIndices.category] || null : null,
      expiry_date: columnIndices.expiry_date !== undefined ? values[columnIndices.expiry_date] || null : null,
      notes: columnIndices.notes !== undefined ? values[columnIndices.notes] || null : null,
    };
    if (!item.name.trim()) continue;
    items.push(item);
  }
  return items;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function readCSVFile(file: File): Promise<ImportedItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error('Failed to read file as text');
        resolve(parseCSV(text));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function downloadCSVTemplate(): void {
  const headers = ['Name', 'Barcode', 'Quantity', 'Location', 'Category', 'Expiry Date', 'Notes'];
  const exampleRows = [
    ['Milk', '123456789012', '2', 'Fridge', 'Dairy', '2025-01-15', 'Organic whole milk'],
    ['Bread', '987654321098', '1', 'Pantry', 'Bakery', '2025-01-05', 'Whole wheat'],
    ['Apples', '', '6', 'Fridge', 'Produce', '2025-01-20', 'Gala apples'],
  ];
  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => row.map(cell => escapeCSV(cell)).join(',')),
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'pantrypal_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function validateImportedItems(items: ImportedItem[]): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  items.forEach((item, index) => {
    const rowNum = index + 2;
    if (!item.name || !item.name.trim()) errors.push(`Row ${rowNum}: Name is required`);
    if (item.quantity && (item.quantity < 0 || isNaN(item.quantity))) {
      errors.push(`Row ${rowNum}: Invalid quantity`);
    }
    if (item.expiry_date) {
      const date = new Date(item.expiry_date);
      if (isNaN(date.getTime())) warnings.push(`Row ${rowNum}: Invalid expiry date format (use YYYY-MM-DD)`);
    }
    if (item.barcode && !/^\d{8,13}$/.test(item.barcode)) {
      warnings.push(`Row ${rowNum}: Barcode should be 8-13 digits`);
    }
  });

  return { errors, warnings, isValid: errors.length === 0 };
}

export default { exportToCSV, parseCSV, readCSVFile, downloadCSVTemplate, validateImportedItems };
