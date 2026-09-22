"""LangChain tools for AI personas to interact with filesystem and shell."""

import os
import subprocess
from pathlib import Path

from langchain_core.tools import tool


@tool
def read_file(path: str) -> str:
    """Read the contents of a file.

    Args:
        path: Path to the file to read
    """
    try:
        return Path(path).read_text()
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except Exception as e:
        return f"Error reading file: {e}"


@tool
def write_file(path: str, content: str) -> str:
    """Write content to a file. Creates parent directories if needed.

    Args:
        path: Path to the file to write
        content: Content to write to the file
    """
    try:
        p = Path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
        return f"Successfully wrote {len(content)} bytes to {path}"
    except Exception as e:
        return f"Error writing file: {e}"


@tool
def list_files(path: str = ".") -> str:
    """List files and directories at the given path.

    Args:
        path: Directory path to list (default: current directory)
    """
    try:
        entries = []
        for entry in sorted(Path(path).iterdir()):
            prefix = "📁 " if entry.is_dir() else "📄 "
            entries.append(f"{prefix}{entry.name}")
        return "\n".join(entries) if entries else "(empty directory)"
    except FileNotFoundError:
        return f"Error: Directory not found: {path}"
    except Exception as e:
        return f"Error listing directory: {e}"


@tool
def run_command(command: str) -> str:
    """Run a shell command and return its output.

    Args:
        command: The shell command to run
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.getcwd()
        )
        output = result.stdout + result.stderr
        return output.strip() if output.strip() else "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 30 seconds"
    except Exception as e:
        return f"Error running command: {e}"


@tool
def search_files(pattern: str, path: str = ".") -> str:
    """Search for files matching a glob pattern.

    Args:
        pattern: Glob pattern (e.g., "*.py", "**/*.json")
        path: Directory to search in (default: current directory)
    """
    try:
        matches = list(Path(path).glob(pattern))
        if matches:
            return "\n".join(str(m) for m in sorted(matches))
        return f"No files matching '{pattern}'"
    except Exception as e:
        return f"Error searching files: {e}"


# Export all tools as a list for easy binding
ALL_TOOLS = [read_file, write_file, list_files, run_command, search_files]


if __name__ == "__main__":
    # Quick test
    print("Available tools:")
    for t in ALL_TOOLS:
        print(f"  {t.name}: {t.description.split(chr(10))[0]}")
    print()
    print("Testing list_files('.'):")
    print(list_files.invoke("."))
