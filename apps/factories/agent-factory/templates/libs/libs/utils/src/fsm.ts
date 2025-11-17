/**
 * Utility type to convert a snake_case or kebab-case string to camelCase.
 * For example, "prd_ready_for_review" becomes "prdReadyForReview".
 */
type CamelCase<S extends string> = S extends `${infer P}_${infer R}`
	? `${Lowercase<P>}${Capitalize<CamelCase<R>>}`
	: S extends `${infer P}-${infer R}`
		? `${Lowercase<P>}${Capitalize<CamelCase<R>>}`
		: S;

/**
 * Utility type to convert a union type to an intersection type.
 */
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
	? I
	: never;

/**
 * Interface defining a single transition configuration.
 */
export interface TransitionConfig {
	action: string;
	from: string;
	/**
	 * The "to" property specifies the target state. It can either be:
	 * - a string representing the target state, or
	 * - a function (synchronous or asynchronous) that returns a string.
	 */
	to: string | ((...args: any[]) => string | Promise<string>);
}

/**
 * Interface for the finite state machine (FSM) configuration.
 */
export interface FSMConfig {
	/** The initial state of the FSM. */
	init: string;
	/** A readonly array of transitions defining the FSM behaviour. */
	transitions: readonly TransitionConfig[];
	/**
	 * Optional hook methods. For example, a hook for entering a state can be provided
	 * as "onEnterGeneratingPrd", and for exiting a state as "onExitCreatingSubtasks".
	 */
	methods?: Record<string, (...args: any[]) => any>;
}

/**
 * Utility type that generates the method signature for a given transition.
 * If the "to" property is a function, its parameter types are inferred; otherwise,
 * the method takes no parameters.
 */
type FSMTransitionMethod<T extends TransitionConfig> = T["to"] extends (...args: infer P) => any
	? { [K in CamelCase<T["action"]>]: (...args: P) => Promise<void> }
	: { [K in CamelCase<T["action"]>]: () => Promise<void> };

/**
 * Utility type that aggregates all transition methods from the FSM configuration.
 */
type FSMTransitionMethods<T extends FSMConfig> = UnionToIntersection<
	T["transitions"][number] extends infer Tr
		? Tr extends TransitionConfig
			? FSMTransitionMethod<Tr>
			: never
		: never
>;

/**
 * The type of the generated state machine. It includes:
 * - a "state" property,
 * - all transition methods with full type safety, and
 * - any hook methods provided via config.methods.
 */
export type GeneratedMachine<T extends FSMConfig> = {
	state: string;
} & FSMTransitionMethods<T> &
	(T extends { methods: infer M } ? M : Record<string, unknown>);

/**
 * Converts a string from snake_case or kebab-case to camelCase at runtime.
 * @param s The input string.
 * @returns The camelCase version of the input.
 */
function toCamelCase(s: string): string {
	return s.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
}

/**
 * Converts a string from snake_case or kebab-case to PascalCase at runtime.
 * @param s The input string.
 * @returns The PascalCase version of the input.
 */
function toPascalCase(s: string): string {
	const camel = toCamelCase(s);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Escapes a string so that it can be used in a regular expression.
 * @param s The string to escape.
 * @returns The escaped string.
 */
function escapeRegExp(s: string): string {
	return s.replace(/[-[\]{}()+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Converts a glob pattern to a RegExp.
 * The glob may contain '*' as a wildcard that matches any sequence of characters.
 * @param glob The glob pattern.
 * @returns A RegExp corresponding to the glob pattern.
 */
function globToRegExp(glob: string): RegExp {
	const parts = glob.split("*").map(escapeRegExp);
	const regexStr = `^${parts.join(".*")}$`;
	return new RegExp(regexStr);
}

/**
 * Generates a state machine based on the provided FSM configuration.
 *
 * The generated machine object is fully type safe:
 * - It maintains a "state" property.
 * - Transition methods are automatically generated with proper parameter types.
 * - Before performing a transition, the machine verifies that the current state
 *   matches the expected "from" state. Glob patterns (e.g. "*" or "parent.*") are supported.
 * - It awaits asynchronous exit and entry hooks (if provided) before and after
 *   state changes.
 *
 * This version utilises a mutex to ensure that transitions are performed sequentially.
 * When a transition starts, a lock is acquired and any subsequent transitions are queued.
 *
 * @param config The finite state machine configuration.
 * @returns A state machine object with transition methods and hooks.
 */
export function generateMachine<T extends FSMConfig>(config: T): GeneratedMachine<T> {
	// Initialise the machine with the initial state.
	const machine: any = {
		state: config.init,
	};

	// Initialise the mutex (transition lock) as a resolved Promise.
	// This will serve as the queue for transitions.
	let transitionLock: Promise<void> = Promise.resolve();

	// Attach any provided hook methods to the machine, binding them to the machine.
	if (config.methods) {
		for (const key in config.methods) {
			if (Object.hasOwn(config.methods, key)) {
				machine[key] = config.methods[key].bind(machine);
			}
		}
	}

	// Iterate over each transition in the configuration.
	for (const transition of config.transitions) {
		// Compute the method name by converting the transition action to camelCase.
		const methodName = toCamelCase(transition.action);
		// Precompile a regular expression if the "from" pattern includes a glob wildcard.
		const patternRegex = transition.from.includes("*") ? globToRegExp(transition.from) : null;

		// Define the state transition method.
		machine[methodName] = async (...args: any[]): Promise<void> => {
			// Define the function that performs the transition.
			const performTransition = async () => {
				// Check if the current state matches the transition's "from" condition.
				if (patternRegex) {
					if (!patternRegex.test(machine.state)) {
						return;
					}
				} else {
					if (machine.state !== transition.from) {
						return;
					}
				}

				// Determine the name of the exit hook for the current state.
				const exitHookName = `onExit${toPascalCase(transition.from.replace("*", ""))}`;
				const exitHook = machine[exitHookName];
				if (typeof exitHook === "function") {
					// Await the exit hook (which may be asynchronous).
					await exitHook();
				}

				// Compute the new state by evaluating the "to" property.
				let newState: string;
				if (typeof transition.to === "function") {
					// Call the transition function with any provided parameters.
					newState = await transition.to.apply(machine, args);
				} else {
					newState = transition.to;
				}

				// Validate that the new state is indeed a string.
				if (typeof newState !== "string") {
					throw new Error(
						`Transition '${transition.action}' did not return a valid state string.`,
					);
				}

				// Update the machine's state.
				machine.state = newState;

				// Determine the name of the entry hook for the new state.
				const enterHookName = `onEnter${toPascalCase(newState)}`;
				const enterHook = machine[enterHookName];
				if (typeof enterHook === "function") {
					// Await the entry hook (which may be asynchronous).
					await enterHook();
				}
			};

			// Chain the transition execution onto the mutex (transitionLock).
			// This ensures that transitions are executed sequentially.
			// We create a new transition promise by chaining performTransition.
			const newTransition = transitionLock.then(() => performTransition());
			// Update the transitionLock.
			// Catch errors so that a rejected transition does not break the chain.
			transitionLock = newTransition.catch(() => {});
			// Return the promise for the current transition.
			return newTransition;
		};
	}

	return machine as GeneratedMachine<T>;
}
