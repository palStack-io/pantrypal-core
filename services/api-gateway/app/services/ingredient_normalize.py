"""Shared pantry/ingredient name-normalization primitives — the single source
of truth for singularization, irregular plurals, and aliases. Used by both
recipe_matcher (recipe ingredient lines) and inventory standardization (pantry
item names). canonical_name() canonicalizes ITEM names; recipe_matcher keeps
its own richer line parser (_normalize_ingredient_name) which strips
quantities/units and is NOT replaced by this."""
import re
import unicodedata

IRREGULAR_PLURALS = {
    'leaves': 'leaf', 'loaves': 'loaf', 'halves': 'half',
    'knives': 'knife', 'shelves': 'shelf', 'scarves': 'scarf',
}

ALIASES = {
    'scallion': 'green onion',
    'spring onion': 'green onion',
    'garbanzo bean': 'chickpea',
    'garbanzo': 'chickpea',
    'aubergine': 'eggplant',
    'courgette': 'zucchini',
    'capsicum': 'bell pepper',
    'rocket': 'arugula',
    'beetroot': 'beet',
    'prawn': 'shrimp',
    "confectioner sugar": 'powdered sugar',
    "confectioner' sugar": 'powdered sugar',
    'icing sugar': 'powdered sugar',
    'caster sugar': 'superfine sugar',
}


def singularize_word(word: str) -> str:
    if word in IRREGULAR_PLURALS:
        return IRREGULAR_PLURALS[word]
    if word.endswith('ies') and len(word) > 4:
        return word[:-3] + 'y'
    if word.endswith('ss'):
        return word
    if re.search(r'(sh|ch|x|z|ss|o)es$', word) and len(word) > 4:
        return word[:-2]
    if word.endswith('s') and len(word) > 3:
        return word[:-1]
    return word


def canonical_name(text: str) -> str:
    """Canonicalize a pantry ITEM name for dedup/comparison: fold accents to
    ASCII, lowercase, strip punctuation, singularize each token, then apply
    longest-match aliases. Returns '' for falsy input."""
    if not text:
        return ""
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9 ]', ' ', text)
    tokens = [singularize_word(w) for w in text.split()]
    result = ' '.join(tokens)
    for alias in sorted(ALIASES, key=len, reverse=True):
        if alias in result:
            result = result.replace(alias, ALIASES[alias])
    return re.sub(r'\s+', ' ', result).strip()
