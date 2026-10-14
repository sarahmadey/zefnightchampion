import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Packs Coach Rex's recorded clips (src/voice/clips/*.mp3) into one base64
 * block plus an index of byte ranges, exposed as `virtual:voice-pack`. One
 * block keeps the single-file build self-contained without a hundred
 * separate data: URLs.
 */
function voicePack(): Plugin {
  const id = 'virtual:voice-pack';
  const resolved = '\0' + id;
  const dir = join(process.cwd(), 'src/voice/clips');
  return {
    name: 'voice-pack',
    resolveId(source) {
      return source === id ? resolved : null;
    },
    load(source) {
      if (source !== resolved) return null;
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.mp3'))
        .sort();
      const index: Record<string, [number, number]> = {};
      const parts: Buffer[] = [];
      let offset = 0;
      for (const f of files) {
        const b = readFileSync(join(dir, f));
        index[f.slice(0, -4)] = [offset, b.length];
        parts.push(b);
        offset += b.length;
        // VOICE_WATCH=1 reloads the page when a clip is re-recorded
        if (process.env.VOICE_WATCH) this.addWatchFile(join(dir, f));
      }
      return `export const index = ${JSON.stringify(index)};\nexport const pack = ${JSON.stringify(Buffer.concat(parts).toString('base64'))};\n`;
    },
  };
}

// `npm run build` makes a normal static site in dist/.
// `npm run build:single` inlines everything into one self-contained HTML file
// (used for the hosted preview).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), voicePack(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 4000,
  },
}));
