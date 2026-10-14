// Quick picks for the goal: the numbers of nights Coach Rex says out loud.

import { useSave } from '../state/store';
import { SPOKEN_GOALS } from '../voice/lines';

export function GoalChips({ label }: { label: string }) {
  const goal = useSave((s) => s.data.rules.goal);
  return (
    <div className="goal-chips" role="radiogroup" aria-label={label}>
      {SPOKEN_GOALS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={goal === n}
          aria-label={`${n} nights`}
          className={`goal-chip${goal === n ? ' on' : ''}`}
          onClick={() => useSave.getState().setGoal(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
