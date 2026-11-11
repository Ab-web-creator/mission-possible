// Moves the single-file build (dist/offline/index.html) to dist/mission-possible-offline.html,
// so the website offers it as a download next to the game.
import { renameSync, rmSync, statSync } from 'node:fs';
renameSync('dist/offline/index.html', 'dist/mission-possible-offline.html');
rmSync('dist/offline', { recursive: true, force: true });
console.log('offline file: dist/mission-possible-offline.html (' + Math.round(statSync('dist/mission-possible-offline.html').size / 1024) + ' kB)');
