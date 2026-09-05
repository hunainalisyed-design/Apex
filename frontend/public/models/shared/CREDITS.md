# 3D Asset Credits

## sedan-sports.glb / Textures/colormap.png

- **Source:** Kenney "Car Kit" — https://kenney.nl/assets/car-kit
- **License:** CC0 1.0 Universal (public domain, no attribution required) — per the pack's own `License.txt`
- **Downloaded:** 2026-09-05, from https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip
- **Used for:** real `body`/`wheel`/`spoiler` geometry in the `/configure` showroom (`frontend/src/components/showroom/PlaceholderShowroomRig.tsx`)
- No modifications made to the geometry or texture; only node transforms are read at runtime. The bundled `colormap.png` texture atlas is not actually applied — every part is recolored via the app's own material props instead.
