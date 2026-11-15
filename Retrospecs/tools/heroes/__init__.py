"""Hero pictures for story cards rendered by tools/story_cards_deck.py (the midnight-copper deck template).

Add a building by dropping `heroes/<card_id>.py` here and listing the id in render_story_decks.DECK_HERO_IDS.

Contract for `heroes/<card_id>.py`:
  SCENES = (scene_0, scene_1, ...)   one callable per card, indexed like tools/story-cards.json[card_id]
  scene_i(th) -> PIL RGBA image of size (W*SS, H*SS) = (2400, 2560), i.e. story_cards_featured.new()
    th  theme dict: story_cards_featured.THEMES[card_id] when the id has one, else a neutral midnight/copper theme
        (keys name, top, bottom, accent, rim, button, head, kick, frame).
    Draw in 1x card pixel coordinates (multiply by SS, or use story_cards_featured.Pen) inside the hero box
    x 28-888, y 28-694 (860 x 666). Only that box is used; it should be filled edge to edge (opaque background).
  The template cover-fits the box into the picture window x 60-856, y 150-750 (796 x 600, chamfered corners, copper
  rim): scale 0.926, full width kept, ~9 px cropped off the top and bottom. Keep key shapes inside the safe area
  x 52-864, y 48-674 (clear of the 20 px corner chamfers and the ~34 px edge vignette). Nothing is drawn over it.
  Spectacles is additive: dark pixels read as see-through, so give form with light, not with black.

Missing module or index -> story_cards_featured.SCENES[card_id] if present -> None (line-drawing fallback).
"""
