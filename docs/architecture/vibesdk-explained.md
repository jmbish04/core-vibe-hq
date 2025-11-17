Architecture Explained: Worker vs. Container

This document explains the separation of responsibilities between the Cloudflare Worker and the Sandbox Container in this architecture.

The Big Idea: Brain vs. Hands

The easiest way to think about this architecture is a "Brain vs. Hands" model.

The Worker is the BRAIN 🧠: It's a lightweight, fast orchestrator. It thinks, plans, and delegates. It manages the conversation and decides what to do next.

The Container is the HANDS 👐: It's a heavy-duty, isolated environment. It does the work. It executes commands, writes files, and runs tests.

This separation is powerful because it keeps the "brain" fast and responsive, while the "hands" can safely perform complex, long-running tasks without blocking the main application.

1. The Cloudflare Worker (The Brain 🧠)

The Worker is the entry point for all API requests and WebSocket connections. It runs the core agent logic.

What it IS:

Orchestrator: It manages the flow of a task from start to finish.

LLM Caller: It's responsible for formatting prompts and calling Large Language Models (LLMs) to get plans, generate code, or analyze results.

State Manager: It holds the agent's state, including the conversation history, the current plan, and the in-memory file tree.

Delegator: It translates the LLM's plan into specific, executable tool calls (e.g., run_analysis, exec_commands).

Result Analyzer: It receives the output from the Container (like logs or error messages) and feeds it back into the LLM to decide the next step.

User Interface: It sends all messages and updates back to the user over the WebSocket.

What it is NOT:

An Execution Environment: It does not run bun install or lint itself.

A File System: It does not have a persistent, writable file system to run a full dev environment.

A Shell: It does not have a terminal or shell.

2. The Sandbox Container (The Hands 👐)

The Container is a remote, secure, and fully isolated execution environment (like a Docker container) that the Worker can "rent" to perform specific tasks.

What it IS:

An Execution Environment: It has a full shell (/bin/bash), a terminal, and all the necessary build tools (like bun, node, tsc).

A Writable File System: It can create, modify, and delete files and directories.

The "Doer": When the Worker calls exec_commands(['bun add lodash']), the Container is where that command actually runs.

The Analyzer: When the Worker calls run_analysis, the Container is what actually runs eslint and tsc against the files.

Reporter: It captures all STDOUT, STDERR, and exit_codes from commands and sends them back to the Worker as a JSON object.

What it is NOT:

"Smart": It has no intelligence of its own. It only does exactly what the Worker tells it to.

A Planner: It never decides what to do. It only receives orders.

A State Manager: It is (or should be treated as) stateless. The Worker is responsible for sending it the files it needs for any given task.

3. Example Workflow: "Fix this bug"

Here is the step-by-step data flow:

User: Sends a WebSocket message: "I'm getting an error cannot find module lodash. Please fix it."

Worker (Brain 🧠):

Receives the message.

Asks an LLM: "The user has this error: cannot find module lodash. What tool should I use?"

The LLM replies: "Use the exec_commands tool to run bun add lodash."

The Worker says: "Okay. I will now run bun add lodash."

It sends a network request to the Container: POST /execute_command with the body {"commands": ["bun add lodash"]}.

Container (Hands 👐):

Receives the request.

Spawns a shell and runs the command bun add lodash.

Captures the output: stdout: "installed lodash...", exit_code: 0.

Sends a network response back to the Worker: {"success": true, "stdout": "installed lodash...", "stderr": "", "exit_code": 0}.

Worker (Brain 🧠):

Receives the successful response from the Container.

Asks the LLM: "I ran bun add lodash and it was successful. What should I do next?"

The LLM replies: "The package is installed. Tell the user the fix is complete."

The Worker sends a WebSocket message to the User: "I've installed the lodash package for you. The error should be resolved!"