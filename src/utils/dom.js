// Small DOM helpers used across UI modules.
export function byId(id) {
  return document.getElementById(id);
}

export function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
