# Optimize emoji styling using material resources

## Goal

Replace text-based emojis with image-based resources (from the `material` folder) throughout the project to improve visual quality and provide a more immersive game UI.

## Confirmed Facts

- The project uses emojis for icons in constants like `resources.ts` (金币, 经验, 钻石, 冒险勋章) and `equipment.ts` (武器, 防具, etc.).
- These icons are rendered in React components (e.g., `ResourceBar.tsx`) via simple `<span>` elements with color styling.
- The `material` folder contains Kenney asset packs: `kenney_particle-pack`, `kenney_roguelike-rpg-pack`, and `kenney_tiny-dungeon`.
- `kenney_roguelike-rpg-pack` and `kenney_tiny-dungeon` contain Spritesheets and individual PNGs suitable for RPG items/resources.

## Requirements

- Update shared constants to point to image references (or CSS classes) instead of emoji strings.
- Update UI components to render image tags or spritesheet spans instead of text emojis.
- Assets from the `material` folder must be incorporated into the `client/public` or `client/src/assets` folder.

## Open Questions

- Asset Pipeline Strategy: Spritesheet vs. Individual PNGs.
- Preferred Asset Pack: Which Kenney pack to prioritize.

## Acceptance Criteria

- [ ] Emoji usages in resource and equipment constants are removed.
- [ ] UI components render the new image assets correctly without layout breakage.
- [ ] The chosen Kenney assets are integrated into the client build pipeline.
