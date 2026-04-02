// Formatting helpers for dates, scores, percentages, and display markup.
export function formatTenths(value) {
  const fixed = Number(value).toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

export function formatPct(value) {
  return formatTenths(value);
}

export function fmtDate(value) {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(value);
}

export function fmtNotesCell(value) {
  if (!value || !String(value).trim()) return '\u2014';
  const note = String(value).trim();
  if (note.length > 48) return note.slice(0, 45) + '\u2026';
  return note;
}

export function fmtScore(score) {
  if (score === null) return '\u2014';
  return String(score);
}

export function scoreToneClass(score) {
  return score === null ? 'score-none' : score >= 51 ? 'score-high' : score >= 31 ? 'score-mid' : 'score-low';
}

export function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) html += '<span class="star-full">\u2605</span>';
    else if (rating >= i - 0.5) html += '<span class="star-half">\u00bd</span>';
    else html += '<span class="star-empty">\u2606</span>';
  }
  return html + '<span class="star-label">' + rating + ' / 5</span>';
}
