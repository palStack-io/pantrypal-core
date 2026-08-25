"""
Stateless data tables for RecipeMatcher.

Static frozensets / dicts that don't depend on the matcher's DB session or
runtime config. Extracted verbatim from the original ``recipe_matcher.py`` and
imported back into ``RecipeMatcher`` as class attributes so ``self._STAPLES``
etc. — and any external ``RecipeMatcher._STAPLES`` access — still resolve.

Aliases and irregular plurals remain the shared single source of truth in
``app/services/ingredient_normalize.py``; they are rebound here (as they were
on the class before) so existing callers of ``RecipeMatcher._ALIASES`` /
``._IRREGULAR_PLURALS`` keep working unchanged.
"""
from ..services.ingredient_normalize import ALIASES as _SHARED_ALIASES
from ..services.ingredient_normalize import IRREGULAR_PLURALS as _SHARED_IRREGULAR_PLURALS

_STAPLES = frozenset({
    'water', 'salt', 'pepper', 'black pepper', 'kosher salt', 'sea salt',
    'oil', 'olive oil', 'vegetable oil', 'cooking spray',
})

_LOW_WEIGHT_HEADS = frozenset("""
    salt pepper oil vinegar sauce powder extract spice seasoning
""".split())

# Measurement units, container words, and prep/descriptor words that carry
# no identity information about the ingredient itself. Scraped ingredient
# lines are full sentences ("1/2 cup finely chopped fresh cilantro, plus
# more for garnish") — everything here is noise between us and "cilantro".
# Stored singularized, since tokens are singularized before the check.
_NOISE_WORDS = frozenset("""
    cup teaspoon tsp tablespoon tbsp tbs ounce oz fluid fl pound lb gram kg mg
    milliliter millilitre ml liter litre quart pint gallon inch cm
    pinch dash handful clove head bunch sprig stalk stick slice piece
    knob pat splash drizzle squeeze
    can jar package packet bag box container bottle carton tin block
    large small medium big baby mini jumbo thin thick
    finely coarsely roughly thinly freshly lightly firmly loosely
    fresh organic whole extra virgin raw free-range grass-fed
    wild-caught canned dried frozen chopped sliced diced minced crushed
    grated shredded ground packed softened melted cooled divided halved
    quartered peeled seeded cored trimmed rinsed drained cooked uncooked
    boneless skinless crumbled cubed torn beaten sifted toasted
    unsalted salted sweetened unsweetened low-fat fat-free reduced
    light heavy pure natural plain all-purpose extra-virgin
    creamy crunchy smooth chunky ripe fine
    optional plus more taste room temperature needed serving garnish
    garnishing slivered about approximately preferably ideally such
    a an of and or for to the with your my in on into
    one two three four five six seven eight nine ten dozen
""".split())

# High-confidence synonyms mapped to one canonical phrase, applied after
# noise-stripping and singularization on BOTH sides (pantry item names and
# recipe ingredient lines), so either naming matches the other.
# NOT cilantro->coriander: American recipes use these for two
# different pantry items (fresh herb vs. dried ground seed) — this
# exact collision showed up live-testing a recipe that calls for
# both "ground coriander" and "cilantro" as separate ingredients.
#
# Aliases and irregular plurals are the shared single source of truth in
# app/services/ingredient_normalize.py — rebound here so existing callers
# of RecipeMatcher._ALIASES / ._IRREGULAR_PLURALS keep working unchanged.
_ALIASES = _SHARED_ALIASES
_IRREGULAR_PLURALS = _SHARED_IRREGULAR_PLURALS
