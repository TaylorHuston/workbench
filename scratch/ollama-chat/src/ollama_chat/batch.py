#!/usr/bin/env python3
"""Batch mode: Read task from INPUT.md, write results to output file."""

import argparse
import re
from pathlib import Path
from .personas import load_personas


def extract_code_blocks(text: str, language: str = "python") -> str:
    """Extract code blocks from markdown text."""
    pattern = rf"```{language}\n(.*?)```"
    matches = re.findall(pattern, text, re.DOTALL)
    return "\n\n".join(matches)


def run_batch(
    input_file: str = "INPUT.md",
    output_file: str = "output.py",
    persona1: str = "developer",
    persona2: str = "critic",
    rounds: int = 2,
    code_only: bool = True,
):
    """Read task from input, run collaboration, write to output."""
    personas = load_personas()

    # Read input
    input_path = Path(input_file)
    if not input_path.exists():
        print(f"Error: {input_file} not found")
        print(f"Create {input_file} with your task/prompt and run again.")
        return

    task = input_path.read_text().strip()
    print(f"📖 Read task from {input_file}")
    print(f"   ({len(task)} chars)")

    # Get personas
    p1 = personas[persona1]
    p2 = personas[persona2]

    print(f"🤖 Running: {p1.name} + {p2.name} ({rounds} rounds)")
    print("-" * 50)

    # Run collaboration
    conversation_log = []
    all_responses = []
    current, other = p1, p2

    for i in range(rounds * 2):
        instruction = """Write working code. Output ONLY the final code in a single ```python block. No explanations.""" if code_only else "Produce concrete output."

        messages = [{"role": "user", "content": f"""Task:
{task}

You are collaborating with {other.name}. Conversation so far:

{chr(10).join(conversation_log) if conversation_log else "(You start!)"}

Your turn. {instruction}"""}]

        print(f"\n{'='*50}")
        print(f"{current.name}:")
        print("=" * 50)

        response = current.respond(messages, show_header=False)
        conversation_log.append(f"[{current.name}]: {response}")
        all_responses.append(response)

        current, other = other, current

    # Write output
    if code_only:
        # Extract code from the last response (final version)
        final_code = extract_code_blocks(all_responses[-1])

        # If no code found in last response, try all responses
        if not final_code:
            for resp in reversed(all_responses):
                final_code = extract_code_blocks(resp)
                if final_code:
                    break

        if final_code:
            Path(output_file).write_text(final_code + "\n")
            print(f"\n{'='*50}")
            print(f"✅ Wrote code to {output_file}")
        else:
            print(f"\n⚠️  No code blocks found in responses")
            # Fall back to full output
            Path(output_file).write_text("\n---\n".join(all_responses))
            print(f"   Wrote full responses to {output_file}")
    else:
        sections = [f"## {p1.name if i % 2 == 0 else p2.name}\n\n{r}" for i, r in enumerate(all_responses)]
        output_content = f"""# Output

**Task:** {input_file}
**Personas:** {p1.name} + {p2.name}
**Rounds:** {rounds}

---

{"---".join(sections)}
"""
        Path(output_file).write_text(output_content)
        print(f"\n{'='*50}")
        print(f"✅ Wrote results to {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Batch collaboration: INPUT.md → output.py")
    parser.add_argument("-i", "--input", default="INPUT.md", help="Input file (default: INPUT.md)")
    parser.add_argument("-o", "--output", default="output.py", help="Output file (default: output.py)")
    parser.add_argument("-p1", "--persona1", default="developer", help="First persona (default: developer)")
    parser.add_argument("-p2", "--persona2", default="critic", help="Second persona (default: critic)")
    parser.add_argument("-r", "--rounds", type=int, default=2, help="Rounds of collaboration (default: 2)")
    parser.add_argument("--full", action="store_true", help="Output full conversation instead of code only")

    args = parser.parse_args()
    run_batch(args.input, args.output, args.persona1, args.persona2, args.rounds, code_only=not args.full)


if __name__ == "__main__":
    main()
