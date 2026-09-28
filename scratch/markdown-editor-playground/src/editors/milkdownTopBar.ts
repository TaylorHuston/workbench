import type { TopBarFeatureConfig } from '@milkdown/crepe/feature/top-bar'
import { editorViewCtx } from '@milkdown/kit/core'
import type { Ctx } from '@milkdown/kit/ctx'

function isEditingFrontmatter(ctx: Ctx) {
  const { $from } = ctx.get(editorViewCtx).state.selection
  return $from.parent.type.name === 'frontmatter'
}

export const milkdownTopBarConfig: TopBarFeatureConfig = {
  buildTopBar: (builder) => {
    const headingGroup = builder.getGroup('heading').group
    const headingSelector = headingGroup.items[0]?.selector

    if (headingSelector) {
      const getActiveLabel = headingSelector.activeLabel
      const options = headingSelector.options

      headingSelector.activeLabel = (ctx) =>
        isEditingFrontmatter(ctx) ? 'Properties' : getActiveLabel(ctx)
      headingSelector.options = options.map((option) => ({
        ...option,
        onSelect: (ctx) => {
          if (!isEditingFrontmatter(ctx)) option.onSelect(ctx)
        },
      }))
    }

    for (const groupKey of ['formatting', 'list', 'insert', 'block', 'more']) {
      const group = builder.getGroup(groupKey).group

      for (const item of group.items) {
        if (!item.onRun) continue

        const onRun = item.onRun
        item.onRun = (ctx) => {
          if (!isEditingFrontmatter(ctx)) onRun(ctx)
        }
      }
    }
  },
}
