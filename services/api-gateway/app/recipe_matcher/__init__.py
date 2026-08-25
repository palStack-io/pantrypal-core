"""
Recipe matching package.

Re-exports the public API verbatim so ``app.recipe_matcher`` imports exactly as
it did when this was a single module:

    from app.recipe_matcher import get_recipe_matcher, RecipeMatcher

The class and its factory live in ``matcher.py``; stateless unit/quantity
helpers and data tables live in ``units.py`` / ``data.py``.
"""
from .matcher import RecipeMatcher, get_recipe_matcher

__all__ = ["RecipeMatcher", "get_recipe_matcher"]
