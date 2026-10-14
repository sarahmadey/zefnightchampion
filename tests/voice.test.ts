import { describe, expect, it } from 'vitest';
import director from '../src/game/director.ts?raw';
import { LINES, clipId, lineText } from '../src/voice/lines';
import { ACCESSORIES } from '../src/game/rewards';

const clips = new Set(Object.keys(import.meta.glob('../src/voice/clips/*.mp3')).map((k) => k.replace(/^.*\/(.*)\.mp3$/, '$1')));

describe('Coach Rex lines', () => {
  it('has a recorded clip for every line (and every twin)', () => {
    const missing: string[] = [];
    for (const [id, line] of Object.entries(LINES)) {
      if (!clips.has(id)) missing.push(id);
      if (line.nameless && !clips.has(`${id}--nameless`)) missing.push(`${id}--nameless`);
      if (line.anyGoal && !clips.has(`${id}--anygoal`)) missing.push(`${id}--anygoal`);
    }
    expect(missing).toEqual([]);
  });

  it('has no clips left over from old lines', () => {
    const wanted = new Set(Object.entries(LINES).flatMap(([id, l]) => [id, ...(l.nameless ? [`${id}--nameless`] : []), ...(l.anyGoal ? [`${id}--anygoal`] : [])]));
    expect([...clips].filter((c) => !wanted.has(c))).toEqual([]);
  });

  it('calls it underwear', () => {
    for (const [id, l] of Object.entries(LINES)) expect(`${l.text} ${l.nameless ?? ''} ${l.anyGoal ?? ''}`, id).not.toMatch(/underpants/i);
  });

  it('only says lines that exist', () => {
    const used = [...director.matchAll(/say(?:Async)?\((?:ctx, )?'([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(20);
    for (const id of used) expect(LINES[id], id).toBeDefined();
    for (const a of ACCESSORIES) expect(LINES[`acc-${a.id}`], a.id).toBeDefined();
    for (let i = 0; i < 7; i++) expect(LINES[`land-${i}`]).toBeDefined();
    for (const n of [1, 2, 3]) expect(LINES[`meter-${n}`]).toBeDefined();
  });

  it('swaps in name-free lines for another name', () => {
    expect(lineText('greet-1', 'Zef')).toBe('Good morning, Zef!');
    expect(lineText('greet-1', 'Milo')).toBe('Good morning, big guy!');
    expect(clipId('greet-1', 'zef')).toBe('greet-1');
    expect(clipId('greet-1', 'Milo')).toBe('greet-1--nameless');
    expect(clipId('dry-1', 'Milo')).toBe('dry-1');
  });

  it('only says "twenty nights" when that is the goal', () => {
    expect(lineText('intro-meter', 'Zef', 20)).toMatch(/twenty nights/);
    expect(lineText('intro-meter', 'Zef', 14)).not.toMatch(/twenty/);
    expect(clipId('intro-meter', 'Zef', 20)).toBe('intro-meter');
    expect(clipId('intro-meter', 'Zef', 14)).toBe('intro-meter--anygoal');
    expect(clipId('intro-meter', 'Milo', 14)).toBe('intro-meter--anygoal');
    expect(clipId('store-open', 'Milo', 14)).toBe('store-open--nameless');
  });
});
