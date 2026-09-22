#!/usr/bin/env python3
"""Simple CLI wrapper for chatting with Ollama models."""

import argparse
import requests
import json
import sys


def chat(model: str, message: str, stream: bool = True) -> str:
    """Send a message to an Ollama model and get a response."""
    url = "http://localhost:11434/api/chat"

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": message}],
        "stream": stream,
    }

    if stream:
        response = requests.post(url, json=payload, stream=True)
        response.raise_for_status()

        full_response = ""
        for line in response.iter_lines():
            if line:
                data = json.loads(line)
                chunk = data.get("message", {}).get("content", "")
                print(chunk, end="", flush=True)
                full_response += chunk
                if data.get("done"):
                    print()  # newline at end
                    break
        return full_response
    else:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()["message"]["content"]


def list_models() -> list[str]:
    """Get list of available models from Ollama."""
    url = "http://localhost:11434/api/tags"
    response = requests.get(url)
    response.raise_for_status()
    return [m["name"] for m in response.json().get("models", [])]


def interactive_chat(model: str):
    """Run an interactive chat session."""
    print(f"Chatting with {model} (type 'quit' or Ctrl+C to exit)\n")

    messages = []

    while True:
        try:
            user_input = input("You: ").strip()
            if user_input.lower() in ("quit", "exit", "q"):
                break
            if not user_input:
                continue

            messages.append({"role": "user", "content": user_input})

            url = "http://localhost:11434/api/chat"
            payload = {"model": model, "messages": messages, "stream": True}

            print("AI: ", end="", flush=True)
            response = requests.post(url, json=payload, stream=True)
            response.raise_for_status()

            assistant_response = ""
            for line in response.iter_lines():
                if line:
                    data = json.loads(line)
                    chunk = data.get("message", {}).get("content", "")
                    print(chunk, end="", flush=True)
                    assistant_response += chunk
                    if data.get("done"):
                        print("\n")
                        break

            messages.append({"role": "assistant", "content": assistant_response})

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break


def main():
    parser = argparse.ArgumentParser(description="Chat with Ollama models")
    parser.add_argument("message", nargs="?", help="Message to send (omit for interactive mode)")
    parser.add_argument("-m", "--model", default="llama3.2", help="Model to use (default: llama3.2)")
    parser.add_argument("-l", "--list", action="store_true", help="List available models")

    args = parser.parse_args()

    if args.list:
        models = list_models()
        print("Available models:")
        for m in models:
            print(f"  - {m}")
        return

    if args.message:
        chat(args.model, args.message)
    else:
        interactive_chat(args.model)


if __name__ == "__main__":
    main()
