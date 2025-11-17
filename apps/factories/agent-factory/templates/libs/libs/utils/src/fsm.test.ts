import { expect, test } from "vitest";
import { generateMachine } from "./fsm";

test("happy path: simple transitions", async () => {
	const config = {
		init: "idle",
		transitions: [
			{ action: "start", from: "idle", to: "running" },
			{ action: "finish", from: "running", to: "completed" },
		],
	} as const;
	const machine = generateMachine(config);
	expect(machine.state).toBe("idle");
	await machine.start();
	expect(machine.state).toBe("running");
	await machine.finish();
	expect(machine.state).toBe("completed");
});

test("function transition with parameter", async () => {
	const config = {
		init: "waiting",
		transitions: [
			{
				action: "advance",
				from: "waiting",
				to: (val: number) => (val > 5 ? "done" : "waiting"),
			},
		],
	} as const;
	const machine = generateMachine(config);
	await machine.advance(3);
	expect(machine.state).toBe("waiting");
	await machine.advance(6);
	expect(machine.state).toBe("done");
});

test("async function transition", async () => {
	const config = {
		init: "start",
		transitions: [
			{
				action: "next",
				from: "start",
				to: async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					return "end";
				},
			},
		],
	} as const;
	const machine = generateMachine(config);
	await machine.next();
	expect(machine.state).toBe("end");
});

test("exit and entry hooks are called in correct order", async () => {
	const callOrder: string[] = [];
	const config = {
		init: "idle",
		methods: {
			onEnterIdle() {
				callOrder.push("enterIdle");
			},
			async onEnterRunning() {
				callOrder.push("enterRunning");
			},
			async onExitIdle() {
				callOrder.push("exitIdle");
			},
			onExitRunning() {
				callOrder.push("exitRunning");
			},
		},
		transitions: [
			{ action: "run", from: "idle", to: "running" },
			{ action: "stop", from: "running", to: "idle" },
		],
	} as const;
	const machine = generateMachine(config);
	await machine.run();
	expect(callOrder).toEqual(["exitIdle", "enterRunning"]);
	await machine.stop();
	expect(callOrder).toEqual(["exitIdle", "enterRunning", "exitRunning", "enterIdle"]);
});

test("should ignore when transition called from invalid state", async () => {
	const config = {
		init: "waiting_to_start",
		transitions: [
			{ action: "ready", from: "waiting_to_start", to: "idle" },
			{ action: "start", from: "idle", to: "running" },
			{ action: "stop", from: "running", to: "idle" },
		],
	} as const;
	const machine = generateMachine(config);
	await machine.stop();
	expect(machine.state).toBe("waiting_to_start");
});

test("should throw error if transition function returns non-string", async () => {
	const config = {
		init: "init",
		transitions: [{ action: "badTransition", from: "init", to: () => 42 }],
	} as const;
	// @ts-expect-error
	const machine = generateMachine(config);
	await expect(machine.badTransition()).rejects.toThrow(/did not return a valid state string/);
});

test("synchronous hooks are called", async () => {
	const callOrder: string[] = [];
	const config = {
		init: "a",
		methods: {
			onEnterB() {
				callOrder.push("enterB");
			},
			onExitA() {
				callOrder.push("exitA");
			},
		},
		transitions: [{ action: "move", from: "a", to: "b" }],
	} as const;
	const machine = generateMachine(config);
	await machine.move();
	expect(callOrder).toEqual(["exitA", "enterB"]);
});

test("exit hook error prevents transition", async () => {
	const config = {
		init: "s1",
		methods: {
			onExitS1() {
				throw new Error("exit error");
			},
		},
		transitions: [{ action: "go", from: "s1", to: "s2" }],
	} as const;
	const machine = generateMachine(config);
	await expect(machine.go()).rejects.toThrow("exit error");
	expect(machine.state).toBe("s1");
});

test("entry hook error after state update", async () => {
	const config = {
		init: "s1",
		methods: {
			onEnterS2() {
				throw new Error("entry error");
			},
		},
		transitions: [{ action: "go", from: "s1", to: "s2" }],
	} as const;
	const machine = generateMachine(config);
	await expect(machine.go()).rejects.toThrow("entry error");
	expect(machine.state).toBe("s2");
});

test("async transition function rejection prevents state update", async () => {
	const config = {
		init: "start",
		transitions: [
			{
				action: "fail",
				from: "start",
				to: async () => {
					await new Promise((_, reject) =>
						setTimeout(() => reject(new Error("transition fail")), 10),
					);
					return "should-not-be-returned";
				},
			},
		],
	} as const;
	const machine = generateMachine(config);
	await expect(machine.fail()).rejects.toThrow("transition fail");
	expect(machine.state).toBe("start");
});

test("duplicate transition actions: latter overrides former", async () => {
	const config = {
		init: "a",
		transitions: [
			{ action: "dup", from: "a", to: "b" },
			{ action: "dup", from: "b", to: "c" },
		],
	} as const;
	const machine = generateMachine(config);
	await machine.dup();
	expect(machine.state).toBe("a");
});

test("empty transitions: machine remains with only state property", () => {
	const config = {
		init: "only",
		transitions: [] as const,
	};
	const machine = generateMachine(config);
	expect(machine.state).toBe("only");
	expect(Object.keys(machine).filter((k) => k !== "state")).toEqual([]);
});

test("async transition returns non-string", async () => {
	const config = {
		init: "init",
		transitions: [
			{
				action: "badAsync",
				from: "init",
				to: async () => 123,
			},
		],
	} as const;
	// @ts-expect-error
	const machine = generateMachine(config);
	await expect(machine.badAsync()).rejects.toThrow(/did not return a valid state string/);
	expect(machine.state).toBe("init");
});

test("glob pattern '*' matches all states", async () => {
	const config = {
		init: "start",
		transitions: [{ action: "reset", from: "*", to: "start" }],
	} as const;
	const machine = generateMachine(config);
	// Set state to an arbitrary value.
	machine.state = "anyState";
	await machine.reset();
	expect(machine.state).toBe("start");
});

test("glob pattern 'parent.*' matches nested states", async () => {
	const config = {
		init: "parent.initial",
		transitions: [
			{
				action: "advance",
				from: "parent.*",
				to: (suffix: string) => `parent.${suffix}`,
			},
		],
	} as const;
	const machine = generateMachine(config);
	await machine.advance("next");
	expect(machine.state).toBe("parent.next");
});

test("transition with non-matching glob pattern does nothing", async () => {
	const config = {
		init: "child",
		transitions: [{ action: "reset", from: "parent.*", to: "start" }],
	} as const;
	const machine = generateMachine(config);
	await machine.reset();
	// Since the current state ("child") does not match "parent.*", no transition occurs.
	expect(machine.state).toBe("child");
});

// --- New tests for the queueing mechanism ---

test("queued transitions: concurrent transitions are executed sequentially", async () => {
	const order: string[] = [];
	const config = {
		init: "start",
		transitions: [
			{
				action: "first",
				from: "start",
				to: async () => {
					order.push("first start");
					// Simulate asynchronous work
					await new Promise((resolve) => setTimeout(resolve, 50));
					order.push("first end");
					return "middle";
				},
			},
			{
				action: "second",
				from: "middle",
				to: async () => {
					order.push("second start");
					// Simulate asynchronous work
					await new Promise((resolve) => setTimeout(resolve, 10));
					order.push("second end");
					return "end";
				},
			},
		],
	} as const;
	const machine = generateMachine(config);
	// Invoke both transitions concurrently.
	const p1 = machine.first();
	const p2 = machine.second();
	await Promise.all([p1, p2]);
	expect(order).toEqual(["first start", "first end", "second start", "second end"]);
	expect(machine.state).toBe("end");
});

test("queued transitions: transitions invoked consecutively are executed in order", async () => {
	const order: string[] = [];
	const config = {
		init: "off",
		transitions: [
			{
				action: "turnOn",
				from: "off",
				to: async () => {
					order.push("turnOn start");
					await new Promise((resolve) => setTimeout(resolve, 30));
					order.push("turnOn end");
					return "on";
				},
			},
			{
				action: "turnOff",
				from: "on",
				to: async () => {
					order.push("turnOff start");
					await new Promise((resolve) => setTimeout(resolve, 20));
					order.push("turnOff end");
					return "off";
				},
			},
		],
	} as const;
	const machine = generateMachine(config);
	void machine.turnOn();
	await machine.turnOff();
	expect(order).toEqual(["turnOn start", "turnOn end", "turnOff start", "turnOff end"]);
	expect(machine.state).toBe("off");
});
