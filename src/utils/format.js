// Formatting helpers for dates, scores, percentages, and display markup.
export function formatTenths(value) {
  const fixed = Number(value).toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}


export function fmtDate(value) {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(value);
}



export function fmtScore(score) {
  if (score === null) return '\u2014';
  return String(score);
}

export function scoreToneClass(score) {
  return score === null ? 'score-none' : score >= 51 ? 'score-high' : score >= 31 ? 'score-mid' : 'score-low';
}

export function renderStars(rating) {
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    if (rating >= i) { span.className = 'star-full'; span.textContent = '\u2605'; }
    else if (rating >= i - 0.5) { span.className = 'star-half'; span.textContent = '\u00bd'; }
    else { span.className = 'star-empty'; span.textContent = '\u2606'; }
    frag.appendChild(span);
  }
  const label = document.createElement('span');
  label.className = 'star-label';
  label.textContent = rating + ' / 5';
  frag.appendChild(label);
  return frag;
}
