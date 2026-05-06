export interface TourStep {
  zoneId: string;
  place: 'right' | 'left' | 'above' | 'below';
  arrow: 'left' | 'right' | 'top' | 'bottom';
  label: string;
  title: string;
  body: string;
}

export const tourSteps: TourStep[] = [
  {
    zoneId: 'tour-nav-inventory',
    place: 'right',
    arrow: 'left',
    label: 'Your Pantry',
    title: 'Everything in one place',
    body: 'All your tracked items live here. Filter by location, category, or expiry status from the sidebar below.',
  },
  {
    zoneId: 'tour-nav-shopping',
    place: 'right',
    arrow: 'left',
    label: 'Shopping List',
    title: 'Never run out again',
    body: 'Move low-stock items to your shopping list with one tap. Check them off as you shop to restock automatically.',
  },
  {
    zoneId: 'tour-nav-insights',
    place: 'right',
    arrow: 'left',
    label: 'Insights',
    title: 'Know your habits',
    body: 'Track consumption patterns, waste stats, and category breakdowns. Spot what you buy most and what goes bad.',
  },
  {
    zoneId: 'tour-nav-recipes',
    place: 'right',
    arrow: 'left',
    label: 'Recipes',
    title: 'Cook what you have',
    body: 'Get recipe ideas based on what\'s already in your pantry. Less waste, more creativity in the kitchen.',
  },
  {
    zoneId: 'tour-add-item',
    place: 'above',
    arrow: 'bottom',
    label: 'Add Items',
    title: 'Add your first item',
    body: 'Scan a barcode or search manually. Set expiry dates and locations to get alerts before things go bad.',
  },
];
