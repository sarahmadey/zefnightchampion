// Coach Rex's clips, packed at build time by the voice-pack plugin in vite.config.ts.
declare module 'virtual:voice-pack' {
  /** clip id -> [byte offset, byte length] within the decoded pack */
  export const index: Record<string, [number, number]>;
  /** every clip's MP3 bytes, back to back, as base64 */
  export const pack: string;
}
