// Apply only against the exact text last seen by this editor.
function classifyEdit(current, base, next) {
  if (current === next) return 'already-applied'
  if (current !== base) return 'conflict'
  return 'apply'
}
module.exports = { classifyEdit }
