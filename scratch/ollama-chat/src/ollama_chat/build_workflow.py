#!/usr/bin/env python3
"""
Build Workflow: Architect → Developer → Reviewer loop.

This workflow:
1. Architect (Claude Code) reads a spec and creates a phased implementation plan
2. For each phase:
   - Developer (Qwen) implements the code
   - Reviewer (Qwen) reviews and scores (0-100)
   - If score < 90: feedback goes back to developer, retry
   - If score >= 90: move to next phase
3. Continues until all phases are complete

Usage:
    python build_workflow.py /path/to/SPEC.md /path/to/output/dir
"""

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict

from .config import DEFAULT_MODEL, DEFAULT_BACKEND, get_agent_config
from .personas import get_llm, send_message, run_claude_code


def send_agent_message(agent_config: dict, prompt: str) -> str:
    """Send a message using the appropriate backend for the agent."""
    backend = agent_config.get("backend", DEFAULT_BACKEND)
    model = agent_config.get("model", DEFAULT_MODEL)
    system_prompt = agent_config.get("system_prompt", "")

    if backend == "claude-code":
        # Use Claude Code CLI headless
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        return run_claude_code(full_prompt, model=model)
    else:
        # Use standard LLM backend (ollama, claude API, etc.)
        return send_message(
            backend=backend,
            model=model,
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )


# =============================================================================
# WORKFLOW LOGGING
# =============================================================================

@dataclass
class WorkflowLog:
    """Tracks the entire build workflow run."""
    started_at: str
    spec_path: str
    output_dir: str
    status: str = "running"  # running, completed, failed
    completed_at: str = None
    current_phase: int = 0
    total_phases: int = 0
    steps: list = field(default_factory=list)
    error: str = None

    def to_dict(self) -> dict:
        return asdict(self)

    def save(self, path: Path):
        path.write_text(json.dumps(self.to_dict(), indent=2))


def log_step(
    log_dir: Path,
    step_num: int,
    step_type: str,
    phase: int,
    attempt: int,
    input_data: dict,
    output_data: dict,
    score: int = None,
):
    """Log a single workflow step to JSON."""
    step = {
        "step": step_num,
        "type": step_type,  # architect, developer, reviewer
        "phase": phase,
        "attempt": attempt,
        "timestamp": datetime.now().isoformat(),
        "input": input_data,
        "output": output_data,
    }
    if score is not None:
        step["score"] = score

    filename = f"{step_num:03d}_{step_type}_phase{phase}_attempt{attempt}.json"
    (log_dir / filename).write_text(json.dumps(step, indent=2))
    return step


@dataclass
class Phase:
    """A single phase from the architect's plan."""
    number: int
    title: str
    goal: str
    files: list[str]
    tasks: list[str]
    acceptance_criteria: list[str]
    raw_text: str


def parse_plan(plan_text: str) -> list[Phase]:
    """Parse the architect's plan into phases."""
    phases = []

    # Split by phase headers
    phase_pattern = r'## Phase (\d+): (.+?)(?=## Phase \d+:|$)'
    matches = re.findall(phase_pattern, plan_text, re.DOTALL)

    for num_str, content in matches:
        num = int(num_str)
        lines = content.strip().split('\n')

        title = lines[0].strip() if lines else f"Phase {num}"
        goal = ""
        files = []
        tasks = []
        criteria = []

        current_section = None
        for line in lines[1:]:
            line_lower = line.lower().strip()

            if line_lower.startswith('**goal:**'):
                goal = line.split(':', 1)[1].strip().strip('*')
                current_section = 'goal'
            elif line_lower.startswith('**files:**'):
                files_text = line.split(':', 1)[1].strip().strip('*')
                if files_text:
                    files = [f.strip() for f in files_text.split(',')]
                current_section = 'files'
            elif line_lower.startswith('**tasks:**'):
                current_section = 'tasks'
            elif line_lower.startswith('**acceptance criteria:**'):
                current_section = 'criteria'
            elif line.strip().startswith('- '):
                item = line.strip()[2:].strip()
                if current_section == 'tasks':
                    tasks.append(item)
                elif current_section == 'criteria':
                    criteria.append(item)
                elif current_section == 'files':
                    files.append(item)

        phases.append(Phase(
            number=num,
            title=title.strip(),
            goal=goal,
            files=files,
            tasks=tasks,
            acceptance_criteria=criteria,
            raw_text=content.strip()
        ))

    return phases


def generate_plan_markdown(phases: list[Phase], completed: set[int] = None) -> str:
    """Generate a PLAN.md file with checkboxes for each phase.

    Args:
        phases: List of parsed phases
        completed: Set of phase numbers that are completed
    """
    completed = completed or set()

    lines = ["# Implementation Plan", ""]

    for phase in phases:
        checkbox = "[x]" if phase.number in completed else "[ ]"
        lines.append(f"## {checkbox} Phase {phase.number}: {phase.title}")
        lines.append("")

        if phase.goal:
            lines.append(f"**Goal:** {phase.goal}")
            lines.append("")

        if phase.files:
            lines.append(f"**Files:** {', '.join(phase.files)}")
            lines.append("")

        if phase.tasks:
            lines.append("**Tasks:**")
            for task in phase.tasks:
                lines.append(f"- {task}")
            lines.append("")

        if phase.acceptance_criteria:
            lines.append("**Acceptance Criteria:**")
            for criterion in phase.acceptance_criteria:
                lines.append(f"- {criterion}")
            lines.append("")

    return "\n".join(lines)


def update_plan_checkbox(plan_path: Path, phase_number: int):
    """Update a phase's checkbox from [ ] to [x] in PLAN.md."""
    if not plan_path.exists():
        return

    content = plan_path.read_text()
    # Replace "## [ ] Phase N:" with "## [x] Phase N:"
    pattern = rf'(## )\[ \]( Phase {phase_number}:)'
    updated = re.sub(pattern, r'\1[x]\2', content)
    plan_path.write_text(updated)


def extract_code_blocks(response: str) -> dict[str, str]:
    """Extract code blocks with filenames from response.

    Expected format:
    ```filename.ext
    code content
    ```
    """
    files = {}
    pattern = r'```(\S+)\n(.*?)```'
    matches = re.findall(pattern, response, re.DOTALL)

    for filename, content in matches:
        # Skip language-only markers like ```javascript
        if '.' in filename or filename in ['html', 'css', 'js', 'json']:
            # Map common language names to extensions
            ext_map = {'javascript': 'js', 'html': 'html', 'css': 'css'}
            if filename in ext_map:
                continue  # Skip pure language markers
            files[filename] = content.strip()

    return files


def extract_score(review: str) -> int:
    """Extract the numeric score from a review."""
    # Look for "## Score: X" or "Score: X"
    pattern = r'Score:\s*(\d+)'
    match = re.search(pattern, review, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return 0


def run_build_workflow(
    spec_path: str,
    output_dir: str,
    pass_threshold: int = 90,
    max_retries: int = 5,
    verbose: bool = True,
):
    """Run the full build workflow.

    Args:
        spec_path: Path to the specification file
        output_dir: Directory to write generated code
        pass_threshold: Minimum score to pass review (default 90)
        max_retries: Max attempts per phase before giving up
        verbose: Print detailed output
    """
    spec_path = Path(spec_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Create workflow log directory
    log_dir = output_dir / ".workflow"
    log_dir.mkdir(exist_ok=True)

    # Initialize workflow log
    workflow_log = WorkflowLog(
        started_at=datetime.now().isoformat(),
        spec_path=str(spec_path),
        output_dir=str(output_dir),
    )
    manifest_path = log_dir / "manifest.json"
    step_counter = 0

    # Read the spec
    if not spec_path.exists():
        print(f"Error: Spec file not found: {spec_path}")
        return False

    spec_content = spec_path.read_text()
    print(f"\n{'='*60}")
    print(f"BUILD WORKFLOW")
    print(f"{'='*60}")
    print(f"Spec: {spec_path}")
    print(f"Output: {output_dir}")
    print(f"Logs: {log_dir}")
    print(f"Pass threshold: {pass_threshold}")
    print(f"{'='*60}\n")

    # Get agent configs
    architect_config = get_agent_config("architect")
    developer_config = get_agent_config("developer")
    reviewer_config = get_agent_config("reviewer")

    # ==========================================================================
    # PHASE 1: Architect creates the plan
    # ==========================================================================
    print("\n" + "="*60)
    print("STEP 1: ARCHITECT CREATING PLAN")
    print("="*60)

    architect_prompt = f"""Read this specification and create a detailed, phased implementation plan.

SPECIFICATION:
{spec_content}

Create a plan with sequential phases. Each phase should be small and independently testable.
Follow the exact output format specified in your instructions."""

    plan = run_claude_code(
        prompt=architect_prompt,
        system_prompt=architect_config["system_prompt"],
        cwd=str(output_dir),
    )

    if plan.startswith("ERROR:"):
        print(f"\nArchitect failed: {plan}")
        workflow_log.status = "failed"
        workflow_log.error = plan
        workflow_log.save(manifest_path)
        return False

    # Log architect step
    step_counter += 1
    log_step(
        log_dir, step_counter, "architect", 0, 1,
        {"spec": spec_content[:500] + "..." if len(spec_content) > 500 else spec_content},
        {"plan": plan},
    )

    # Parse phases
    phases = parse_plan(plan)
    if not phases:
        print("\nError: Could not parse any phases from the plan")
        print("Raw plan output:")
        print(plan[:500])
        return False

    # Save the formatted plan with checkboxes (next to SPEC.md)
    plan_path = spec_path.parent / "PLAN.md"
    plan_markdown = generate_plan_markdown(phases)
    plan_path.write_text(plan_markdown)
    print(f"\nPlan saved to: {plan_path}")

    print(f"\nParsed {len(phases)} phases:")
    for phase in phases:
        print(f"  [ ] Phase {phase.number}: {phase.title}")

    # Update workflow log
    workflow_log.total_phases = len(phases)
    workflow_log.save(manifest_path)

    # ==========================================================================
    # PHASE 2+: Developer/Reviewer loop for each phase
    # ==========================================================================

    # Track all files written to disk
    all_files: set[str] = set()

    for phase in phases:
        workflow_log.current_phase = phase.number
        workflow_log.save(manifest_path)
        print(f"\n{'='*60}")
        print(f"PHASE {phase.number}: {phase.title}")
        print(f"{'='*60}")
        print(f"Goal: {phase.goal}")
        print(f"Files: {', '.join(phase.files) if phase.files else 'TBD'}")
        print(f"Acceptance Criteria:")
        for criterion in phase.acceptance_criteria:
            print(f"  - {criterion}")

        phase_passed = False
        attempt = 0
        feedback = ""

        while not phase_passed and attempt < max_retries:
            attempt += 1
            print(f"\n--- Attempt {attempt}/{max_retries} ---")

            # Developer implements
            print(f"\n[Developer implementing...]")

            # Read current state of all project files from disk
            current_files_context = ""
            if all_files:
                current_files_context = "\n\nCURRENT PROJECT FILES:\n"
                for filename in sorted(all_files):
                    file_path = output_dir / filename
                    if file_path.exists():
                        content = file_path.read_text()
                        current_files_context += f"\n```{filename}\n{content}\n```\n"

            # On retry, provide feedback and instruct to edit existing files
            if attempt > 1 and feedback:
                developer_prompt = f"""Fix the code for Phase {phase.number}: {phase.title}

GOAL: {phase.goal}

ACCEPTANCE CRITERIA:
{chr(10).join('- ' + c for c in phase.acceptance_criteria)}

REVIEWER FEEDBACK:
{feedback}

{current_files_context}

Read the existing files above and fix the issues mentioned in the feedback.
Output the COMPLETE updated file contents for any files that need changes:

```filename.ext
[complete file contents]
```

Only output files that need to be modified."""

            else:
                # First attempt - create new files
                developer_prompt = f"""Implement Phase {phase.number}: {phase.title}

GOAL: {phase.goal}

TASKS:
{chr(10).join('- ' + t for t in phase.tasks)}

ACCEPTANCE CRITERIA:
{chr(10).join('- ' + c for c in phase.acceptance_criteria)}
{current_files_context}

Write the complete code for all files needed. Output each file as:

```filename.ext
[complete file contents]
```"""

            developer_response = send_agent_message(developer_config, developer_prompt)

            # Extract code from response
            new_code = extract_code_blocks(developer_response)

            # Log developer step
            step_counter += 1
            log_step(
                log_dir, step_counter, "developer", phase.number, attempt,
                {"prompt": developer_prompt[:1000] + "..." if len(developer_prompt) > 1000 else developer_prompt},
                {"response": developer_response, "files": list(new_code.keys())},
            )

            if not new_code:
                print("Warning: No code blocks extracted from developer response")
                feedback = "Your response did not contain any properly formatted code blocks. Use ```filename.ext format."
                continue

            # Write files to disk immediately
            print(f"Files written: {', '.join(new_code.keys())}")
            for filename, content in new_code.items():
                file_path = output_dir / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                file_path.write_text(content)
                all_files.add(filename)
                print(f"  Wrote: {file_path}")

            # Reviewer reviews - read files from disk
            print(f"\n[Reviewer evaluating...]")

            # Gather all relevant files for this phase from disk
            files_to_review = set(new_code.keys())
            # Also include any previously written files that might be related
            for f in all_files:
                if any(f.endswith(ext) for ext in ['.html', '.css', '.js', '.json']):
                    files_to_review.add(f)

            code_for_review = ""
            for filename in sorted(files_to_review):
                file_path = output_dir / filename
                if file_path.exists():
                    content = file_path.read_text()
                    code_for_review += f"\n```{filename}\n{content}\n```\n"

            reviewer_prompt = f"""Review this code for Phase {phase.number}: {phase.title}

GOAL: {phase.goal}

ACCEPTANCE CRITERIA:
{chr(10).join('- ' + c for c in phase.acceptance_criteria)}

CODE TO REVIEW:
{code_for_review}

Evaluate the code against the acceptance criteria and provide your review."""

            review_response = send_agent_message(reviewer_config, reviewer_prompt)

            # Extract score
            score = extract_score(review_response)
            print(f"\nScore: {score}/100")

            # Log reviewer step
            step_counter += 1
            log_step(
                log_dir, step_counter, "reviewer", phase.number, attempt,
                {"prompt": reviewer_prompt[:1000] + "..." if len(reviewer_prompt) > 1000 else reviewer_prompt},
                {"response": review_response, "score": score},
                score=score,
            )

            if score >= pass_threshold:
                print(f"✓ Phase {phase.number} PASSED!")
                phase_passed = True
                # Update PLAN.md checkbox
                update_plan_checkbox(plan_path, phase.number)
            else:
                print(f"✗ Phase {phase.number} needs revision (score: {score} < {pass_threshold})")
                # Extract feedback for next attempt
                feedback_match = re.search(
                    r'Feedback for Developer:\s*(.+?)(?=##|$)',
                    review_response,
                    re.DOTALL | re.IGNORECASE
                )
                if feedback_match:
                    feedback = feedback_match.group(1).strip()
                else:
                    feedback = review_response

        if not phase_passed:
            print(f"\n✗ Phase {phase.number} FAILED after {max_retries} attempts")
            workflow_log.status = "failed"
            workflow_log.error = f"Phase {phase.number} failed after {max_retries} attempts"
            workflow_log.completed_at = datetime.now().isoformat()
            workflow_log.save(manifest_path)
            return False

    # ==========================================================================
    # COMPLETE
    # ==========================================================================
    workflow_log.status = "completed"
    workflow_log.completed_at = datetime.now().isoformat()
    workflow_log.save(manifest_path)

    print(f"\n{'='*60}")
    print("BUILD COMPLETE!")
    print(f"{'='*60}")
    print(f"Output directory: {output_dir}")
    print(f"Workflow logs: {log_dir}")
    print(f"Files created:")
    for filename in sorted(all_files):
        print(f"  - {filename}")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Build workflow: Architect → Developer → Reviewer loop"
    )
    parser.add_argument("spec", help="Path to specification file")
    parser.add_argument("output", help="Output directory for generated code")
    parser.add_argument(
        "--threshold", type=int, default=90,
        help="Minimum score to pass review (default: 90)"
    )
    parser.add_argument(
        "--max-retries", type=int, default=5,
        help="Max attempts per phase (default: 5)"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    success = run_build_workflow(
        spec_path=args.spec,
        output_dir=args.output,
        pass_threshold=args.threshold,
        max_retries=args.max_retries,
        verbose=args.verbose,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
