import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The supplied parser is Pi's frontmatter parser; keeping I/O here makes precedence testable.
export async function loadPersona(id, { agentDir, cwd, configDir, projectTrusted, parse }) {
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(id)) {
    throw new Error('Persona ID must contain lowercase letters, numbers, hyphens or underscores');
  }
  const paths = [
    ...(projectTrusted ? [join(cwd, configDir, 'personas', `${id}.md`)] : []),
    join(agentDir, 'personas', `${id}.md`),
  ];
  for (const path of paths) {
    let content;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const { frontmatter, body } = parse(content);
    if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
      throw new Error(`Invalid frontmatter in persona ${id}`);
    }
    if (frontmatter.name !== undefined && (typeof frontmatter.name !== 'string' || !frontmatter.name.trim())) {
      throw new Error(`Persona ${id} must have a nonempty string name`);
    }
    if (!body.trim()) throw new Error(`Persona ${id} has no instructions`);
    return { id, name: frontmatter.name?.trim() ?? id, instructions: body.trim() };
  }
  throw new Error(`Persona not found: ${id}`);
}
