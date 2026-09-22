#!/usr/bin/env python3
"""Two AI personas collaborating on a task."""

import argparse
from .personas import load_personas, Persona


def run_collaboration(persona1: Persona, persona2: Persona, task: str, rounds: int = 3):
    """Run a multi-round collaboration between two personas."""
    print(f"\n{'#'*60}")
    print(f"TASK: {task}")
    print(f"{'#'*60}")
    print(f"\nCollaborators: {persona1.name} + {persona2.name}")
    print(f"Rounds: {rounds}")

    conversation_log = []

    current = persona1
    other = persona2

    for i in range(rounds * 2):
        messages = [{"role": "user", "content": f"""Task: {task}

You are collaborating with {other.name}. Here's the conversation so far:

{chr(10).join(conversation_log) if conversation_log else "(No messages yet - you start!)"}

Now it's your turn. Respond as {current.name}. Remember: produce concrete output, not just discussion."""}]

        response = current.respond(messages)
        conversation_log.append(f"[{current.name}]: {response}")

        current, other = other, current

    print(f"\n{'#'*60}")
    print("COLLABORATION COMPLETE")
    print(f"{'#'*60}")

    return conversation_log


def main():
    personas = load_personas()

    parser = argparse.ArgumentParser(description="Two AI personas collaborate on a task")
    parser.add_argument("task", nargs="?", help="The task for the personas to work on")
    parser.add_argument("-p1", "--persona1", default="architect", choices=personas.keys(),
                        help="First persona (default: architect)")
    parser.add_argument("-p2", "--persona2", default="developer", choices=personas.keys(),
                        help="Second persona (default: developer)")
    parser.add_argument("-r", "--rounds", type=int, default=3,
                        help="Number of back-and-forth rounds (default: 3)")
    parser.add_argument("-m1", "--model1", help="Override model for persona 1")
    parser.add_argument("-m2", "--model2", help="Override model for persona 2")
    parser.add_argument("-l", "--list", action="store_true", help="List available personas")
    parser.add_argument("--config", help="Path to personas.json config file")

    args = parser.parse_args()

    if args.config:
        personas = load_personas(args.config)

    if args.list:
        print("Available personas:")
        for name, p in personas.items():
            print(f"\n  {name} ({p.backend}:{p.model}):")
            print(f"    {p.system_prompt.split(chr(10))[0]}")
        return

    if not args.task:
        parser.error("task is required (unless using -l/--list)")

    p1 = personas[args.persona1]
    p2 = personas[args.persona2]

    if args.model1:
        p1.model = args.model1
    if args.model2:
        p2.model = args.model2

    run_collaboration(p1, p2, args.task, args.rounds)


if __name__ == "__main__":
    main()
