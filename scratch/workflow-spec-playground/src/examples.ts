export type Example = { id: string; title: string; description: string; yaml: string }

// These describe decisions for inspection, not executable human tasks.
// `set` is used to give a conceptual step a valid DSL representation.
export const examples: Example[] = [
  {
    id: 'idea-triage',
    title: 'Triage an idea',
    description: 'A decision splits an idea into exploration or a parking place.',
    yaml: `document:
  dsl: '1.0.3'
  namespace: fieldbook
  name: triage-an-idea
  version: '0.1.0'
  title: Triage an idea
input:
  schema:
    format: json
    document:
      type: object
      properties:
        priority:
          type: string
          enum: [now, later]
      required: [priority]
do:
  - captureIdea:
      set:
        note: Write the idea in one sentence
  - decideNextStep:
      switch:
        - exploreNow:
            when: $context.priority == "now"
            then: exploreIdea
        - later:
            then: parkIdea
  - exploreIdea:
      do:
        - frameQuestion:
            set:
              note: What would this help me learn?
        - sketchOptions:
            set:
              note: List two or three possible approaches
      then: exit
  - parkIdea:
      set:
        note: Save the idea for a future review
`,
  },
  {
    id: 'weekly-review',
    title: 'Weekly review',
    description: 'A simple sequence with a decision at the end.',
    yaml: `document:
  dsl: '1.0.3'
  namespace: fieldbook
  name: weekly-review
  version: '0.1.0'
  title: Weekly review
input:
  schema:
    format: json
    document:
      type: object
      properties:
        needsFollowUp:
          type: boolean
      required: [needsFollowUp]
do:
  - gatherNotes:
      set:
        note: Gather notes from the past week
  - noticePatterns:
      set:
        note: Name the work that took the most attention
  - chooseFollowUp:
      switch:
        - takeAction:
            when: $context.needsFollowUp == true
            then: captureAction
        - finished:
            then: exit
  - captureAction:
      set:
        note: Write down one next action
`,
  },
  {
    id: 'reading-loop',
    title: 'Reading loop',
    description: 'A minimal linear process to compare source and diagram.',
    yaml: `document:
  dsl: '1.0.3'
  namespace: fieldbook
  name: reading-loop
  version: '0.1.0'
  title: Reading loop
do:
  - chooseSource:
      set:
        note: Pick one source worth reading
  - captureClaim:
      set:
        note: Restate the main claim in my own words
  - testUnderstanding:
      set:
        note: Identify what I would need to check
`,
  },
]
