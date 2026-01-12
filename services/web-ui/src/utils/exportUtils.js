// Export utility functions for CSV operations

/**
 * Convert items to CSV format
 */
export function exportToCSV(items, filename = 'pantry_items.csv') {
  if (!items || items.length === 0) {
    alert('No items to export');
    return;
  }
  
  // Define CSV headers
  const headers = [
    'Name',
    'Barcode',
    'Quantity',
    'Location',
    'Category',
    'Expiry Date',
    'Added Date',
    'Notes',
  ];
  
  // Convert items to CSV rows
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
  
  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  // Create blob and download
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

/**
 * Escape special characters in CSV
 */
function escapeCSV(str) {
  if (str === null || str === undefined) return '';
  
  str = String(str);
  
  // If string contains comma, quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    // Escape quotes by doubling them
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  
  return str;
}

/**
 * Parse CSV file to items array
 */
export function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }
  
  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);
  
  // Map common header variations
  const headerMap = {
    'name': ['name', 'item', 'product', 'item name'],
    'barcode': ['barcode', 'upc', 'ean', 'code'],
    'quantity': ['quantity', 'qty', 'amount', 'count'],
    'location': ['location', 'place', 'where', 'storage'],
    'category': ['category', 'type', 'cat', 'group'],
    'expiry_date': ['expiry date', 'expiry', 'exp date', 'expires', 'expiration'],
    'notes': ['notes', 'note', 'description', 'desc', 'comments'],
  };
  
  // Find column indices
  const columnIndices = {};
  for (const [key, variations] of Object.entries(headerMap)) {
    const index = headers.findIndex(h => 
      variations.includes(h.toLowerCase().trim())
    );
    if (index !== -1) {
      columnIndices[key] = index;
    }
  }
  
  // Check if name column exists (required)
  if (columnIndices.name === undefined) {
    throw new Error('CSV must contain a "Name" column');
  }
  
  // Parse data rows
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    // Skip empty rows
    if (values.length === 0 || values.every(v => !v)) continue;
    
    const item = {
      name: values[columnIndices.name] || '',
      barcode: values[columnIndices.barcode] || null,
      quantity: parseInt(values[columnIndices.quantity]) || 1,
      location: values[columnIndices.location] || null,
      category: values[columnIndices.category] || null,
      expiry_date: values[columnIndices.expiry_date] || null,
      notes: values[columnIndices.notes] || null,
    };
    
    // Skip if name is empty
    if (!item.name.trim()) continue;
    
    items.push(item);
  }
  
  return items;
}

/**
 * Parse a single CSV line (handles quotes and commas correctly)
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Read CSV file from File input
 */
export function readCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const items = parseCSV(text);
        resolve(items);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Generate CSV template
 */
export function downloadCSVTemplate() {
  const headers = [
    'Name',
    'Barcode',
    'Quantity',
    'Location',
    'Category',
    'Expiry Date',
    'Notes',
  ];
  
  const exampleRows = [
    ['Milk', '123456789012', '2', 'Fridge', 'Dairy', '2025-01-15', 'Organic whole milk'],
    ['Bread', '987654321098', '1', 'Pantry', 'Bakery', '2025-01-05', 'Whole wheat'],
    ['Apples', '', '6', 'Fridge', 'Produce', '2025-01-20', 'Gala apples'],
  ];
  
  const csvContent = [
    headers.join(','),
    ...exampleRows.map(row => row.map(cell => escapeCSV(cell)).join(','))
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

/**
 * Validate imported items
 */
export function validateImportedItems(items) {
  const errors = [];
  const warnings = [];
  
  items.forEach((item, index) => {
    const rowNum = index + 2; // +2 for header and 0-indexing
    
    // Check required fields
    if (!item.name || !item.name.trim()) {
      errors.push(`Row ${rowNum}: Name is required`);
    }
    
    // Check quantity
    if (item.quantity && (item.quantity < 0 || isNaN(item.quantity))) {
      errors.push(`Row ${rowNum}: Invalid quantity`);
    }
    
    // Check expiry date format
    if (item.expiry_date) {
      const date = new Date(item.expiry_date);
      if (isNaN(date.getTime())) {
        warnings.push(`Row ${rowNum}: Invalid expiry date format (use YYYY-MM-DD)`);
      }
    }
    
    // Check barcode format (if present)
    if (item.barcode && !/^\d{8,13}$/.test(item.barcode)) {
      warnings.push(`Row ${rowNum}: Barcode should be 8-13 digits`);
    }
  });
  
  return { errors, warnings, isValid: errors.length === 0 };
}

export default {
  exportToCSV,
  parseCSV,
  readCSVFile,
  downloadCSVTemplate,
  validateImportedItems,
};
