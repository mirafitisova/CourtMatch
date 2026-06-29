/** Returns the timestamp (ms) of the Monday that starts the week containing `d` (UTC). */
export function getWeekMonday(d: Date): number {
  const date = new Date(d);
  const day = date.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Returns the current hitting streak in weeks.
 * A streak is consecutive Mon–Sun weeks with ≥1 completed session.
 * It resets to 0 if a full week passes with no completed sessions.
 */
export function calculateStreak(sessionDates: Date[]): number {
  if (sessionDates.length === 0) return 0;

  const weekSet = new Set(sessionDates.map(getWeekMonday));
  const sorted = Array.from(weekSet).sort((a, b) => b - a); // descending

  const currentWeek = getWeekMonday(new Date());
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const gapToLatest = Math.round((currentWeek - sorted[0]) / ONE_WEEK);

  // gapToLatest = 0 → session this week  ✓
  // gapToLatest = 1 → session last week, this week still in progress  ✓
  // gapToLatest ≥ 2 → a full week passed with no sessions → streak = 0
  if (gapToLatest >= 2) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.round((sorted[i - 1] - sorted[i]) / ONE_WEEK) === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
