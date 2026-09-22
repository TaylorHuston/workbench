#!/usr/bin/env python3
"""AI agent with tool-calling capabilities."""

import argparse
from langchain_core.messages import HumanMessage, SystemMessage

from .config import DEFAULT_MODEL, DEFAULT_BACKEND
from .personas import get_llm
from .tools import ALL_TOOLS


def run_agent(
    task: str,
    backend: str = DEFAULT_BACKEND,
    model: str = DEFAULT_MODEL,
    max_iterations: int = 10,
):
    """Run an agent with tools to complete a task."""
    print(f"🤖 Agent: {backend}:{model}")
    print(f"📋 Task: {task}")
    print(f"🔧 Tools: {', '.join(t.name for t in ALL_TOOLS)}")
    print("=" * 60)

    # Get LLM with tools bound
    llm = get_llm(backend, model)
    llm_with_tools = llm.bind_tools(ALL_TOOLS)

    system_prompt = """You are a helpful AI agent with access to tools.
You MUST use the available tools to complete tasks - do not just describe what you would do.

Available tools:
- read_file(path): Read file contents
- write_file(path, content): Write/create files
- list_files(path): List directory contents
- run_command(command): Run shell commands
- search_files(pattern, path): Find files by pattern

IMPORTANT: When a task requires file operations or commands, USE THE TOOLS.
After using tools and completing the task, provide a brief summary of what you did."""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=task),
    ]

    for i in range(max_iterations):
        print(f"\n--- Iteration {i + 1} ---")

        # Get response
        response = llm_with_tools.invoke(messages)

        # Check for tool calls
        if response.tool_calls:
            print(f"🔧 Tool calls: {[tc['name'] for tc in response.tool_calls]}")

            # Execute each tool call
            for tool_call in response.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]

                print(f"   Calling {tool_name}({tool_args})")

                # Find and execute the tool
                tool_fn = next((t for t in ALL_TOOLS if t.name == tool_name), None)
                if tool_fn:
                    result = tool_fn.invoke(tool_args)
                    print(f"   Result: {result[:200]}{'...' if len(result) > 200 else ''}")

                    # Add tool result to messages
                    from langchain_core.messages import ToolMessage
                    messages.append(response)
                    messages.append(ToolMessage(content=result, tool_call_id=tool_call["id"]))
                else:
                    print(f"   Unknown tool: {tool_name}")
        else:
            # No tool calls - agent is done
            print(f"\n✅ Final response:")
            print(response.content)
            return response.content

    print("\n⚠️ Max iterations reached")
    return None


def main():
    parser = argparse.ArgumentParser(description="AI agent with tools")
    parser.add_argument("task", nargs="?", help="Task for the agent")
    parser.add_argument("-b", "--backend", default="ollama", choices=["ollama", "claude"])
    parser.add_argument("-m", "--model", default=DEFAULT_MODEL, help="Model to use (must support tools)")
    parser.add_argument("--max-iter", type=int, default=10, help="Max iterations")

    args = parser.parse_args()

    if not args.task:
        # Interactive mode
        print("AI Agent (type 'quit' to exit)")
        print("=" * 40)
        while True:
            try:
                task = input("\nTask: ").strip()
                if task.lower() in ("quit", "exit", "q"):
                    break
                if task:
                    run_agent(task, args.backend, args.model, args.max_iter)
            except KeyboardInterrupt:
                print("\nGoodbye!")
                break
    else:
        run_agent(args.task, args.backend, args.model, args.max_iter)


if __name__ == "__main__":
    main()
