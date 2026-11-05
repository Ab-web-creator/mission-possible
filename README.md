# Mission (Im)possible

A maze-and-lamps game for children: the Pilgrim lights lamps to drive away demons
that stand for things like Doubt, Anxiety, Anger and Greed. Each demon has a
child-friendly description, a wisdom line and a tip in the Field guide.

## Run it

You need Node.js (18 or newer).

```bash
npm install      # first time only
npm run dev      # starts the game at http://localhost:5173 and reloads on every save
```

`npm run build` makes a ready-to-host version in `dist/`.

## Where things are

| File | What's in it |
| --- | --- |
| `src/data/levels.js` | The fixed level maps, one per level, with the legend at the top |
| `src/data/enemies.js` | Demon stats (speed, damage, how they move and shoot) and power-ups |
| `src/data/lore.js` | Field-guide texts: description, wisdom line, tip |
| `src/data/intros.js` | Which level introduces which new demon |
| `src/data/themes.js` | Colours per level range (Meadow, Ice Cavern, Lava Forge, ...) |
| `src/game.js` | The engine: movement, demon behaviour, drawing, sound, menus |
| `src/style.css` | Layout and look of the side panel and pop-ups |
| `index.html` | The page itself |
| `public/` | Images, sounds and music files |

## Publish on GitHub Pages

1. Create an empty repository on GitHub called `mission-possible`.
2. In this folder:
   ```bash
   git remote add origin https://github.com/<your-name>/mission-possible.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: GitHub Actions**.
   Every push to `main` now publishes the game at
   `https://<your-name>.github.io/mission-possible/`.

## Roadmap

- Split `src/game.js` further: `player.js`, `demons/`, `bombs.js`, `audio.js`, `screens.js`
- Levels 47+ from screenshots
- Introduce Theft and Carelessness
- Optional: move rendering to Phaser for sprites, animation and sound management
