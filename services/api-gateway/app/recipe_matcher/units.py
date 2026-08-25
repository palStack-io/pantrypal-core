"""
Stateless unit / quantity machinery for RecipeMatcher.

Pure functions and data tables that carry no dependency on the matcher's DB
session or runtime config. Extracted verbatim from the original
``recipe_matcher.py`` module so the behavior is identical; ``matcher.py``
delegates to these via thin instance-method shims so existing call sites
(including tests that call ``m._to_base_quantity`` / ``m._canonical_unit``)
keep working unchanged.
"""
import re
from datetime import datetime
from typing import Any, Optional, Tuple

_UNIT_ALIASES = {
    'teaspoon': 'tsp', 'teaspoons': 'tsp', 't': 'tsp', 'tsp': 'tsp',
    'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbsp': 'tbsp', 'tbs': 'tbsp',
    'cup': 'cup', 'cups': 'cup',
    'ounce': 'oz', 'ounces': 'oz', 'oz': 'oz',
    'fluidounce': 'fl_oz', 'fluidounces': 'fl_oz', 'floz': 'fl_oz',
    'pound': 'lb', 'pounds': 'lb', 'lb': 'lb', 'lbs': 'lb',
    'gram': 'g', 'grams': 'g', 'g': 'g',
    'kilogram': 'kg', 'kilograms': 'kg', 'kg': 'kg',
    'milliliter': 'ml', 'millilitre': 'ml', 'milliliters': 'ml', 'ml': 'ml',
    'liter': 'l', 'litre': 'l', 'liters': 'l', 'l': 'l',
    'pint': 'pt', 'pints': 'pt', 'pt': 'pt',
    'quart': 'qt', 'quarts': 'qt', 'qt': 'qt',
    'gallon': 'gal', 'gallons': 'gal', 'gal': 'gal',
    'can': 'count', 'cans': 'count', 'jar': 'count', 'jars': 'count',
    'package': 'count', 'packages': 'count', 'packet': 'count', 'packets': 'count',
    'box': 'count', 'boxes': 'count', 'bag': 'count', 'bags': 'count',
    'clove': 'count', 'cloves': 'count', 'head': 'count', 'heads': 'count',
    'bunch': 'count', 'bunches': 'count', 'piece': 'count', 'pieces': 'count',
    'slice': 'count', 'slices': 'count',
    'dozen': 'dozen',
}

_UNIT_TO_BASE = {
    'tsp': ('volume', 4.92892),
    'tbsp': ('volume', 14.7868),
    'cup': ('volume', 236.588),
    'fl_oz': ('volume', 29.5735),
    'ml': ('volume', 1.0),
    'l': ('volume', 1000.0),
    'pt': ('volume', 473.176),
    'qt': ('volume', 946.353),
    'gal': ('volume', 3785.41),
    'oz': ('mass', 28.3495),
    'lb': ('mass', 453.592),
    'g': ('mass', 1.0),
    'kg': ('mass', 1000.0),
    'count': ('count', 1.0),
    'dozen': ('count', 12.0),
}

_NUMBER_WORDS = {
    'a': 1.0, 'an': 1.0, 'one': 1.0, 'two': 2.0, 'three': 3.0,
    'four': 4.0, 'five': 5.0, 'six': 6.0, 'seven': 7.0,
    'eight': 8.0, 'nine': 9.0, 'ten': 10.0, 'eleven': 11.0,
    'twelve': 12.0,
}


def to_float(value: Any) -> Optional[float]:
    if value in (None, ''):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_date(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        if hasattr(value, 'isoformat') and not isinstance(value, str):
            return datetime.fromisoformat(value.isoformat())
        return datetime.fromisoformat(str(value).replace('Z', ''))
    except ValueError:
        return None


def canonical_unit(unit: Any) -> Optional[str]:
    if not unit:
        return None
    cleaned = re.sub(r'[^a-zA-Z]', '', str(unit).lower())
    return _UNIT_ALIASES.get(cleaned)


def extract_quantity_unit(text: str) -> Tuple[Optional[float], Optional[str]]:
    unit_pattern = (
        r'teaspoons?|tsp|tablespoons?|tbsp|tbs|cups?|fluid\s+ounces?|fl\s*oz|'
        r'ounces?|oz|pounds?|lbs?|lb|grams?|g|kilograms?|kg|milliliters?|'
        r'millilitres?|ml|liters?|litres?|l|pints?|pt|quarts?|qt|gallons?|gal|'
        r'cans?|jars?|packages?|packets?|boxes?|bags?|cloves?|heads?|bunches?|'
        r'pieces?|slices?|dozen'
    )
    match = re.search(
        rf'\b(?P<qty>\d+\s+\d+\s*/\s*\d+|\d+[½⅓⅔¼¾⅛]|\d+\s*(?:-|to)\s*\d+|\d+(?:\.\d+)?|\d+\s*/\s*\d+|[½⅓⅔¼¾⅛])\s*(?P<unit>{unit_pattern})?\b',
        text or '',
        re.IGNORECASE
    )
    if match:
        return parse_fraction(match.group('qty')), canonical_unit(match.group('unit'))

    word_match = re.search(
        rf'\b(?P<qty>{"|".join(_NUMBER_WORDS)})\b\s*(?P<unit>{unit_pattern})?\b',
        text or '',
        re.IGNORECASE
    )
    if not word_match:
        return None, None
    return _NUMBER_WORDS.get(word_match.group('qty').lower()), canonical_unit(word_match.group('unit'))


def extract_package_size(notes: str) -> Tuple[Optional[float], Optional[str]]:
    match = re.search(
        r'\b(?P<qty>\d+\s+\d+\s*/\s*\d+|\d+[½⅓⅔¼¾⅛]|\d+(?:\.\d+)?|\d+\s*/\s*\d+|[½⅓⅔¼¾⅛])\s*(?P<unit>fl\s*oz|fluid\s+ounces?|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|liters|pint|pints|pt|quart|quarts|qt|gallon|gallons|gal|cup|cups)\b',
        notes or '',
        re.IGNORECASE
    )
    if not match:
        return None, None
    return parse_fraction(match.group('qty')), canonical_unit(match.group('unit'))


def parse_fraction(value: str) -> Optional[float]:
    if not value:
        return None
    value = value.strip()
    unicode_fractions = {'½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125}
    if value in unicode_fractions:
        return unicode_fractions[value]
    for symbol, fraction in unicode_fractions.items():
        if value.endswith(symbol) and value[:-1].isdigit():
            return float(value[:-1]) + fraction
    range_match = re.match(r'(?P<start>\d+(?:\.\d+)?)\s*(?:-|to)\s*(?P<end>\d+(?:\.\d+)?)$', value)
    if range_match:
        return to_float(range_match.group('start'))
    mixed_match = re.match(r'(?P<whole>\d+)\s+(?P<num>\d+)\s*/\s*(?P<den>\d+)$', value)
    if mixed_match:
        try:
            return float(mixed_match.group('whole')) + (
                float(mixed_match.group('num')) / float(mixed_match.group('den'))
            )
        except (ValueError, ZeroDivisionError):
            return None
    if '/' in value:
        parts = [p.strip() for p in value.split('/', 1)]
        try:
            return float(parts[0]) / float(parts[1])
        except (ValueError, ZeroDivisionError):
            return None
    return to_float(value)


def to_base_quantity(quantity: float, unit: str) -> Optional[Tuple[str, float]]:
    unit_info = _UNIT_TO_BASE.get(unit)
    if not unit_info:
        return None
    dimension, factor = unit_info
    return dimension, quantity * factor
