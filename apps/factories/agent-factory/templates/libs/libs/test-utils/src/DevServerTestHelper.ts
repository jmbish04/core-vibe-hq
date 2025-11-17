import { type ChildProcess, spawn } from "node:child_process";
import getPort from "get-port";
import waitOn from "wait-on";

export class DevServerTestHelper {
	private serverProcess?: ChildProcess;
	private port?: number;
	private serverUrl?: string;

	/**
	 * Spins up the local dev server on a dynamically allocated port,
	 * waits until the server is reachable, then returns the server URL.
	 */
	public async start(): Promise<string> {
		// 1. Get an available port.
		this.port = await getPort();
		this.serverUrl = `http://localhost:${this.port}`;

		// 2. Spawn the dev server, discarding its output.
		this.serverProcess = spawn("npm", ["run", "dev", "--", `--port=${this.port}`], {
			shell: true,
			stdio: "ignore",
		});

		// 3. Wait until the server is responding.
		await waitOn({ resources: [this.serverUrl] });

		return this.serverUrl;
	}

	/**
	 * Cleans up by killing the spawned server process.
	 */
	public stop(): void {
		if (this.serverProcess) {
			this.serverProcess.kill("SIGTERM");
		}
	}
}
