#!/usr/bin/env python3
"""Interactive chat room with multiple AI personas."""

import argparse
import readline  # enables arrow keys, history in input()
from .personas import load_personas, Persona


def print_help():
    """Print help message."""
    print("""
\033[1mChat Room Commands:\033[0m
  @<persona> <message>  - Send message to a specific persona
  @all <message>        - Send message to all active personas
  /add <persona>        - Add a persona to the room
  /remove <persona>     - Remove a persona from the room
  /list                 - List active personas
  /personas             - List all available personas
  /clear                - Clear conversation history
  /help                 - Show this help
  /quit                 - Exit chat room

\033[1mExamples:\033[0m
  @architect Design a REST API for a todo app
  @claude What do you think of Architect's design?
  @all Let's write a haiku together
""")


def main():
    all_personas = load_personas()

    parser = argparse.ArgumentParser(description="Interactive chat room with AI personas")
    parser.add_argument("--personas", "-p", nargs="+", default=["architect", "developer"],
                        help="Initial personas to include (default: architect developer)")
    parser.add_argument("--config", help="Path to personas.json config file")
    args = parser.parse_args()

    if args.config:
        all_personas = load_personas(args.config)

    # Initialize active personas
    active_personas: dict[str, Persona] = {}
    for name in args.personas:
        if name in all_personas:
            active_personas[name] = all_personas[name]
        else:
            print(f"Warning: Unknown persona '{name}', skipping")

    # Shared conversation log
    conversation_log: list[str] = []

    print("\033[1;32m" + "=" * 50 + "\033[0m")
    print("\033[1;32m  AI Chat Room\033[0m")
    print("\033[1;32m" + "=" * 50 + "\033[0m")
    print(f"\nActive personas: {', '.join(active_personas.keys())}")
    print("Type /help for commands, /quit to exit\n")

    while True:
        try:
            user_input = input("\033[1;33mYou:\033[0m ").strip()

            if not user_input:
                continue

            # Commands
            if user_input.startswith("/"):
                cmd = user_input.lower().split()

                if cmd[0] in ("/quit", "/exit"):
                    print("Goodbye!")
                    break

                elif cmd[0] == "/help":
                    print_help()

                elif cmd[0] == "/list":
                    print(f"Active personas: {', '.join(active_personas.keys())}")

                elif cmd[0] == "/personas":
                    print("Available personas:")
                    for name, p in all_personas.items():
                        status = "✓" if name in active_personas else " "
                        print(f"  [{status}] {name} ({p.backend}:{p.model})")

                elif cmd[0] == "/add" and len(cmd) > 1:
                    name = cmd[1]
                    if name in all_personas:
                        active_personas[name] = all_personas[name]
                        print(f"Added {name} to the room")
                    else:
                        print(f"Unknown persona: {name}")

                elif cmd[0] == "/remove" and len(cmd) > 1:
                    name = cmd[1]
                    if name in active_personas:
                        del active_personas[name]
                        print(f"Removed {name} from the room")
                    else:
                        print(f"{name} is not in the room")

                elif cmd[0] == "/clear":
                    conversation_log.clear()
                    for p in active_personas.values():
                        p.history.clear()
                    print("Conversation cleared")

                else:
                    print(f"Unknown command: {cmd[0]}. Type /help for commands.")

                continue

            # @ mentions
            if user_input.startswith("@"):
                parts = user_input.split(" ", 1)
                target = parts[0][1:].lower()
                message = parts[1] if len(parts) > 1 else ""

                if not message:
                    print("Please include a message after the @mention")
                    continue

                conversation_log.append(f"[You -> @{target}]: {message}")

                if target == "all":
                    for name, persona in active_personas.items():
                        response = persona.respond_with_history(message, conversation_log)
                        conversation_log.append(f"[{persona.name}]: {response}")

                elif target in active_personas:
                    persona = active_personas[target]
                    response = persona.respond_with_history(message, conversation_log)
                    conversation_log.append(f"[{persona.name}]: {response}")

                else:
                    print(f"Unknown persona: @{target}")
                    print(f"Active personas: {', '.join(active_personas.keys())}")

            else:
                print("Use @<persona> to address someone, or /help for commands")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except EOFError:
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
