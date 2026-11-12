import { syntaxTree } from '@codemirror/language';
import { Decoration, ViewPlugin } from '@codemirror/view';
import { checkUpdateAction, mouseSelectingField } from 'codemirror-live-markdown';

// The upstream preview only reveals a CodeMark when the selection touches the
// mark itself. Reveal both delimiters when the selection touches the code span.
function decorations(state) {
  if (state.field(mouseSelectingField, false)) return Decoration.none;
  const ranges = [];
  syntaxTree(state).iterate({ enter(node) {
    if (node.name !== 'InlineCode') return;
    if (!state.selection.ranges.some((range) => range.from <= node.to && range.to >= node.from)) return;
    const source = state.doc.sliceString(node.from, node.to);
    if (source.startsWith('`$') && source.endsWith('$`')) return;
    for (let child = node.node.firstChild; child; child = child.nextSibling) {
      if (child.name === 'CodeMark' && child.from < child.to) ranges.push(Decoration.mark({ class: 'cm-inline-code-delimiter' }).range(child.from, child.to));
    }
  } });
  return Decoration.set(ranges, true);
}

export const inlineCodePreview = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = decorations(view.state); }
  update(update) { if (checkUpdateAction(update) === 'rebuild') this.decorations = decorations(update.state); }
}, { decorations: (plugin) => plugin.decorations });
