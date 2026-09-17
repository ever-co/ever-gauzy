import { Injectable } from '@nestjs/common';
import { IOperationDefinition, IOperationStepDefinition } from './operation.contract';

/**
 * Raised when an operation is started whose type no plugin registered.
 *
 * Refusing is the point: half-executing an operation whose steps are unknown would leave an
 * aggregate in a state nothing knows how to undo.
 */
export class OperationTypeUnknownError extends Error {
	readonly code = 'OPERATION_TYPE_UNKNOWN';

	constructor(readonly type: string) {
		super(`No definition is registered for the operation type "${type}".`);
		this.name = 'OperationTypeUnknownError';
	}
}

/**
 * The definitions an operation type resolves to.
 *
 * The registry is per-process: a plugin registers its definitions from an `OnModuleInit` provider at
 * bootstrap, and the executor refuses to start an operation whose type is absent rather than
 * inventing a plan for it. Declarations are validated here, at registration time, because a
 * definition that is wrong is a deployment mistake and must fail loudly at startup instead of
 * halfway through a checkout.
 */
@Injectable()
export class OperationRegistry {
	private readonly definitions = new Map<string, IOperationDefinition>();

	/**
	 * Registers the steps of an operation type.
	 *
	 * @param type The operation type, for example `CHECKOUT_COMPLETE`.
	 * @param definition The steps and their budgets.
	 * @throws Error when the definition is unusable or the type is already registered differently.
	 */
	register(type: string, definition: IOperationDefinition): void {
		if (!type) {
			throw new Error('An operation definition must declare a type.');
		}

		const registered = this.definitions.get(type);

		if (registered === definition) {
			// Registration is idempotent: a module loaded twice must not fail startup.
			return;
		}

		if (registered) {
			throw new Error(`A definition for the operation type "${type}" is already registered.`);
		}

		this.validate(type, definition);
		this.definitions.set(type, definition);
	}

	/**
	 * Whether a type has a definition.
	 *
	 * @param type The operation type.
	 * @returns True when the type can be executed in this process.
	 */
	has(type: string): boolean {
		return this.definitions.has(type);
	}

	/**
	 * The definition of a type, when there is one.
	 *
	 * @param type The operation type.
	 * @returns The definition, or undefined.
	 */
	get(type: string): IOperationDefinition | undefined {
		return this.definitions.get(type);
	}

	/**
	 * The definition of a type.
	 *
	 * @param type The operation type.
	 * @returns The definition.
	 * @throws OperationTypeUnknownError when no definition is registered.
	 */
	require(type: string): IOperationDefinition {
		const definition = this.definitions.get(type);

		if (!definition) {
			throw new OperationTypeUnknownError(type);
		}

		return definition;
	}

	/**
	 * The step of a definition with a given name.
	 *
	 * @param type The operation type.
	 * @param stepName The step name.
	 * @returns The step, or undefined when the persisted step no longer exists in the definition.
	 */
	stepOf(type: string, stepName: string): IOperationStepDefinition | undefined {
		return this.get(type)?.steps.find((step) => step.name === stepName);
	}

	/**
	 * Every registered operation type.
	 *
	 * @returns The type names, in registration order.
	 */
	types(): string[] {
		return Array.from(this.definitions.keys());
	}

	/**
	 * Rejects a definition the runtime could not execute deterministically.
	 *
	 * @param type The operation type, for the error message.
	 * @param definition The definition to check.
	 */
	private validate(type: string, definition: IOperationDefinition): void {
		if (!definition || !Array.isArray(definition.steps) || definition.steps.length === 0) {
			throw new Error(`The definition of "${type}" declares no steps.`);
		}

		const names = new Set<string>();
		const orders = new Set<number>();

		for (const step of definition.steps) {
			if (!step?.name) {
				throw new Error(`A step of "${type}" declares no name.`);
			}

			if (typeof step.invoke !== 'function') {
				throw new Error(`The step "${step.name}" of "${type}" declares no invoke handler.`);
			}

			if (names.has(step.name)) {
				throw new Error(`The definition of "${type}" declares the step "${step.name}" twice.`);
			}

			// Equal orders would leave the execution order undefined, and the compensating walk is the
			// reverse of it — so the order has to be total, not merely sorted.
			if (orders.has(step.order)) {
				throw new Error(`The definition of "${type}" declares two steps at order ${step.order}.`);
			}

			names.add(step.name);
			orders.add(step.order);
		}
	}
}
