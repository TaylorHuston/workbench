import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { loadPersona } from './personas.mjs';

export default function personaExtension(pi: ExtensionAPI) {
  pi.registerFlag('persona', {
    description: 'Select a Markdown persona for this session',
    type: 'string',
  });

  let active: { id: string; name: string; instructions: string } | undefined;
  pi.on('session_start', async (_event, ctx) => {
    active = undefined;
    const requested = pi.getFlag('persona');
    if (typeof requested !== 'string') return;
    try {
      active = await loadPersona(requested, {
        agentDir: getAgentDir(), cwd: ctx.cwd, configDir: CONFIG_DIR_NAME,
        projectTrusted: ctx.isProjectTrusted(), parse: parseFrontmatter,
      });
      ctx.ui.notify(`Persona: ${active.name}`, 'info');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Could not load persona: ${detail}. No persona selected.`, 'warning');
    }
  });

  pi.on('before_agent_start', (event) => {
    if (active) {
      event.systemPromptOptions.sections.persona = `Persona: ${active.name}\n${active.instructions}`;
    }
  });
}
