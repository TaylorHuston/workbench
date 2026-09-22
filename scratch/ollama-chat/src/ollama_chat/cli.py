"""Multi-agent chat CLI."""

import re
import sys

from .personas import load_personas, send_message


class Chat:
    """Multi-agent chat with shared history."""

    def __init__(self):
        self.personas = load_personas()
        self.history: list[dict] = []

    def parse_input(self, text: str) -> tuple[str | None, str]:
        """Parse @mention from input.

        '@developer hello' -> ('developer', 'hello')
        'hello' -> (None, 'hello')
        """
        match = re.match(r'^@(\w+)\s*(.*)', text.strip())
        if match:
            return match.group(1), match.group(2)
        return None, text

    def respond(self, agent_name: str, message: str) -> str:
        """Get response from agent with shared history."""
        if agent_name not in self.personas:
            print(f"Unknown agent: @{agent_name}")
            print(f"Available: {', '.join('@' + n for n in self.personas)}")
            return ""

        persona = self.personas[agent_name]

        # Add user message to history
        self.history.append({
            "role": "user",
            "content": message
        })

        # Print header
        print(f"\n\033[1;36m{persona.name}\033[0m \033[90m({persona.backend}:{persona.model})\033[0m")

        # Get streaming response
        response = send_message(
            persona.backend,
            persona.model,
            persona.system_prompt,
            self.history
        )

        # Add to history with speaker tag
        self.history.append({
            "role": "assistant",
            "content": f"[{persona.name}]: {response}"
        })

        return response


def main():
    chat = Chat()

    # Banner
    agents = ', '.join('@' + n for n in chat.personas)
    print("ollama-chat")
    print(f"[{agents}]")
    print("Type /help for commands, /quit to exit\n")

    while True:
        try:
            text = input("> ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break

        if not text:
            continue

        # Slash commands
        if text.startswith("/"):
            if text in ("/quit", "/exit", "/q"):
                break
            elif text == "/help":
                print("@agent message  - Talk to an agent")
                print("/history        - Show conversation history")
                print("/clear          - Clear conversation history")
                print("/quit           - Exit")
            elif text == "/history":
                if not chat.history:
                    print("No history yet")
                else:
                    for msg in chat.history:
                        role = msg['role']
                        content = msg['content']
                        preview = content[:80] + "..." if len(content) > 80 else content
                        print(f"{role}: {preview}")
            elif text == "/clear":
                chat.history = []
                print("History cleared")
            else:
                print(f"Unknown command: {text}")
            continue

        # Parse @mention
        agent, message = chat.parse_input(text)

        if not agent:
            print("Use @agent to talk. Example: @developer hello")
            print(f"Available: {agents}")
            continue

        if not message:
            print("No message provided")
            continue

        chat.respond(agent, message)
        print()


if __name__ == "__main__":
    main()
