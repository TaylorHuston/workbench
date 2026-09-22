#!/usr/bin/env python3
"""
Session-aware Conversational Chat Interface.

Natural language chat with persistent history that can:
- Resume conversations across sessions
- Extract structured specs from discussions
- Trigger workflows to implement designs

Usage:
    # Start or resume a session
    python3 conversation.py my-project

    # In the chat:
    /help           - Show commands
    /history        - Show conversation history
    /summarize      - Extract spec from conversation
    /spec           - Show saved spec
    /workflow       - Run implementation workflow
    /save           - Force save
    /quit           - Exit
"""

from __future__ import annotations

import argparse
import sys

from .config import DEFAULT_MODEL, DEFAULT_BACKEND
from .sessions import Session, list_sessions, DEFAULT_SESSIONS_DIR
from .personas import get_llm, send_message
from .workflow import create_spec_implement_review_workflow


# =============================================================================
# SYSTEM PROMPTS
# =============================================================================

CONVERSATION_SYSTEM_PROMPT = """You are a helpful AI assistant engaged in a natural conversation.
You're helping the user design and plan software projects.

Be conversational and collaborative:
- Ask clarifying questions
- Suggest improvements
- Help refine requirements
- Point out edge cases they might have missed

When the user seems satisfied with a design, let them know they can use /summarize to extract a spec."""

SPEC_EXTRACTION_PROMPT = """Based on the conversation below, extract a clear, structured specification.

Format the spec as:
## Overview
[What this project/feature does]

## Requirements
- [Requirement 1]
- [Requirement 2]
...

## Interface
[Function signatures, API endpoints, or UI elements]

## Edge Cases
- [Edge case 1]
- [Edge case 2]

## Success Criteria
- [How to know it's working]

Conversation:
{conversation}

Extract a comprehensive spec from this conversation:"""


# =============================================================================
# CHAT COMMANDS
# =============================================================================

def handle_command(cmd: str, session: Session, args: argparse.Namespace) -> bool:
    """Handle a slash command. Returns True if should continue, False to exit."""
    cmd = cmd.lower().strip()

    if cmd in ("/quit", "/exit", "/q"):
        print("\nGoodbye!")
        return False

    elif cmd in ("/help", "/h", "/?"):
        print("""
Commands:
  /help, /h       - Show this help
  /history        - Show conversation history
  /summary        - Show session summary
  /summarize      - Extract spec from conversation
  /spec           - Show saved spec
  /workflow       - Run implementation workflow with spec
  /clear          - Clear conversation history
  /save           - Force save session
  /quit, /q       - Exit
""")

    elif cmd == "/history":
        history = session.get_history_text()
        if history:
            print(f"\n{'='*60}\nCONVERSATION HISTORY\n{'='*60}\n")
            print(history)
            print(f"\n{'='*60}\n")
        else:
            print("No conversation history yet.")

    elif cmd == "/summary":
        print(f"\n{session.summary()}\n")

    elif cmd == "/summarize":
        if len(session.messages) < 2:
            print("Not enough conversation to summarize. Chat more first!")
            return True

        print("\nExtracting spec from conversation...\n")

        # Get conversation text
        conversation = session.get_history_text()

        # Use LLM to extract spec
        llm = get_llm(session.backend, session.model)
        from langchain_core.messages import HumanMessage, SystemMessage
        messages = [
            SystemMessage(content="You are a technical writer who extracts clear specifications from conversations."),
            HumanMessage(content=SPEC_EXTRACTION_PROMPT.format(conversation=conversation)),
        ]

        spec = ""
        for chunk in llm.stream(messages):
            print(chunk.content, end="", flush=True)
            spec += chunk.content
        print("\n")

        # Save spec
        spec_path = session.save_spec(spec)
        print(f"\n✅ Spec saved to: {spec_path}")
        print("Use /workflow to implement it.")

    elif cmd == "/spec":
        spec = session.get_spec()
        if spec:
            print(f"\n{'='*60}\nSAVED SPEC\n{'='*60}\n")
            print(spec)
            print(f"\n{'='*60}\n")
        else:
            print("No spec saved. Use /summarize to extract one from the conversation.")

    elif cmd == "/workflow":
        spec = session.get_spec()
        if not spec:
            print("No spec found. Use /summarize first to extract a spec.")
            return True

        print("\n🚀 Starting implementation workflow...\n")

        # Create and run workflow
        workflow = create_spec_implement_review_workflow(
            spec_model=args.spec_model,
            spec_backend=args.spec_backend,
            impl_model=args.impl_model,
            review_model=args.review_model,
            pass_threshold=args.threshold,
        )

        # Run with the spec as the task (skip spec generation)
        from workflow import (
            Workflow, ImplementerNode, ReviewerNode
        )

        # Create a simpler workflow that skips spec writing
        impl_workflow = (
            Workflow("implement_from_spec")
            .add_node("implement", ImplementerNode(
                model=args.impl_model,
                backend="ollama",
            ))
            .add_node("review", ReviewerNode(
                model=args.review_model,
                backend="ollama",
                pass_threshold=args.threshold,
            ))
            .add_edge("implement", "review")
            .add_conditional_edge(
                "review",
                lambda state: "done" if state.get("passed", False) else "implement"
            )
            .set_entry("implement")
            .set_finish("done")
        )

        result = impl_workflow.run(
            initial_state={
                "task": "Implement the following specification",
                "spec": spec,
                "max_iterations": args.max_iter,
            },
            persist=True,
        )

        # Link workflow to session
        if result:
            print(f"\n{'='*60}")
            print("IMPLEMENTATION COMPLETE")
            print(f"{'='*60}")
            print(f"Iterations: {result.get('iteration', 0)}")
            print(f"Final Score: {result.get('score', 'N/A')}")
            print(f"\nGenerated Code:\n")
            print(result.get('code', 'No code generated'))

            # Save code to file
            code = result.get('code', '')
            if code:
                output_path = session.session_dir / "output.py"
                output_path.write_text(code)
                print(f"\n✅ Code saved to: {output_path}")

    elif cmd == "/clear":
        session.messages = []
        session._save()
        print("Conversation cleared.")

    elif cmd == "/save":
        session._save()
        print("Session saved.")

    else:
        print(f"Unknown command: {cmd}")
        print("Type /help for available commands.")

    return True


# =============================================================================
# MAIN CHAT LOOP
# =============================================================================

def chat_loop(session: Session, args: argparse.Namespace):
    """Main interactive chat loop."""
    print(f"\n{'='*60}")
    print(f"SESSION: {session.name}")
    print(f"Model: {session.backend}:{session.model}")
    if session.messages:
        print(f"Resuming conversation ({len(session.messages)} messages)")
    print(f"{'='*60}")
    print("Type /help for commands, /quit to exit\n")

    # Show last few messages if resuming
    if session.messages:
        print("Recent conversation:")
        print("-" * 40)
        for msg in session.messages[-4:]:
            prefix = "You" if msg.role == "user" else "AI"
            content = msg.content[:100] + "..." if len(msg.content) > 100 else msg.content
            print(f"{prefix}: {content}")
        print("-" * 40)
        print()

    while True:
        try:
            user_input = input("You: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nGoodbye!")
            break

        if not user_input:
            continue

        # Handle commands
        if user_input.startswith("/"):
            if not handle_command(user_input, session, args):
                break
            continue

        # Add user message
        session.add_user_message(user_input)

        # Get AI response
        print("AI: ", end="", flush=True)

        llm = get_llm(session.backend, session.model)
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

        # Build messages for LLM
        lc_messages = [SystemMessage(content=CONVERSATION_SYSTEM_PROMPT)]
        for msg in session.messages:
            if msg.role == "user":
                lc_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                lc_messages.append(AIMessage(content=msg.content))

        # Stream response
        response = ""
        for chunk in llm.stream(lc_messages):
            print(chunk.content, end="", flush=True)
            response += chunk.content
        print("\n")

        # Save assistant response
        session.add_assistant_message(response)


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Session-aware conversational chat",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 conversation.py my-project        # Start/resume session
  python3 conversation.py -l                # List sessions
  python3 conversation.py my-project --new  # Force new session
"""
    )
    parser.add_argument("session", nargs="?", help="Session name")
    parser.add_argument("-l", "--list", action="store_true", help="List all sessions")
    parser.add_argument("--new", action="store_true", help="Force create new session")
    parser.add_argument("-d", "--description", default="", help="Session description (for new sessions)")

    # Model options
    parser.add_argument("-m", "--model", default=DEFAULT_MODEL, help="Model for conversation")
    parser.add_argument("-b", "--backend", default="ollama", help="Backend (ollama/claude)")

    # Workflow options
    parser.add_argument("--spec-model", default=DEFAULT_MODEL, help="Model for spec writing")
    parser.add_argument("--spec-backend", default="ollama", help="Backend for spec model")
    parser.add_argument("--impl-model", default=DEFAULT_MODEL, help="Model for implementation")
    parser.add_argument("--review-model", default=DEFAULT_MODEL, help="Model for review")
    parser.add_argument("--threshold", type=int, default=85, help="Pass threshold (0-100)")
    parser.add_argument("--max-iter", type=int, default=5, help="Max workflow iterations")

    args = parser.parse_args()

    if args.list:
        sessions = list_sessions()
        if not sessions:
            print("No sessions found. Start one with: python3 conversation.py <name>")
            return

        print(f"\n{'Name':<25} {'Messages':<10} {'Spec':<6} {'Updated':<20}")
        print("-" * 65)
        for s in sessions:
            spec_indicator = "✓" if s.has_spec else ""
            updated = s.updated_at[:16] if s.updated_at else ""
            print(f"{s.name:<25} {s.message_count:<10} {spec_indicator:<6} {updated:<20}")
        return

    if not args.session:
        parser.print_help()
        return

    # Create or load session
    session = Session(
        args.session,
        model=args.model,
        backend=args.backend,
    )

    if args.new:
        try:
            session.create(args.description)
            print(f"Created new session: {args.session}")
        except FileExistsError:
            print(f"Session '{args.session}' already exists. Use without --new to resume.")
            return
    else:
        created = session.load_or_create(args.description)
        if created:
            print(f"Created new session: {args.session}")

    # Start chat loop
    chat_loop(session, args)


if __name__ == "__main__":
    main()
