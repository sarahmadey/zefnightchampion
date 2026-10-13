// Runtime copies of the accessibility settings, readable from per-frame code.

export const motion = {
  reduced: false,
  /** multiplier for idle sway, drifting decorations and camera wobble */
  scale: 1,
};

export function applyMotionSetting(reduced: boolean) {
  motion.reduced = reduced;
  motion.scale = reduced ? 0.3 : 1;
}
