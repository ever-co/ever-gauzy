/**
 * The lookup class-validator needs from Nest: `INestApplicationContext.get` with a non-strict search,
 * which is what `app.select(ValidatorModule).get(someClass)` already did when class-validator called it.
 */
export interface ValidatorProviderSource {
	get(typeOrToken: Function, options: { strict: boolean }): unknown;
}

/**
 * A class-validator container (`useContainer`) that answers each class from a cache.
 *
 * **Why.** The bootstrap used to hand class-validator Nest's application context directly. class-validator
 * then asks that container for EVERY constraint of EVERY validated property, on every request — and for its
 * own `Validator` once per `validate()` call. Only the handful of database-backed constraints of
 * `ValidatorModule` are Nest providers; for every other one (`@IsString`, `@IsUUID`, ...) Nest raises an
 * `UnknownElementException` (an `Error`, stack trace and all), which class-validator catches
 * (`fallbackOnErrors`) before falling back to its own default container — a linear scan of every instance it
 * ever created. That was 10–40 thrown exceptions per validated request, for an answer that never changes.
 *
 * **What it answers — the same thing as before, once.**
 * - A class Nest provides comes from Nest, so the database-backed constraints keep their injected
 *   repositories. Asked once, then cached: a provider class-validator can use is a static singleton, and
 *   the lookup host Nest searches is built once per context anyway, so later answers could not differ.
 * - A class Nest does not provide (it throws) is instantiated with `new`, once, and that instance is
 *   reused — exactly what class-validator's default container does (`container.js`: find the instance
 *   recorded for the class, else `new someClass()` and record it), minus the linear scan.
 * - A falsy answer from Nest is passed through and not cached, as class-validator does for a container
 *   that answers nothing without `fallback` set.
 * - A constructor that throws is not cached; the error reaches class-validator, whose `fallbackOnErrors`
 *   retries it in its default container, where it throws again — as it did before.
 *
 * The one thing not shared with class-validator's default container is instances it created BEFORE
 * `useContainer` was called (during module loading or seeding): those stay in its container, and this one
 * creates its own. Validator constraints hold no state, so that is not observable.
 */
export class CachedValidatorContainer {
	private readonly instances = new Map<Function, unknown>();

	/**
	 * @param source - Where DI-provided constraints come from (the Nest application context).
	 */
	constructor(private readonly source: ValidatorProviderSource) {}

	/**
	 * The instance class-validator should use for a class.
	 *
	 * @param someClass - The class class-validator needs an instance of.
	 * @returns The cached instance, Nest's provider, or a new instance created once.
	 */
	get<T>(someClass: new (...args: any[]) => T): T {
		if (this.instances.has(someClass)) {
			return this.instances.get(someClass) as T;
		}

		let instance: T;
		try {
			instance = this.source.get(someClass, { strict: false }) as T;
		} catch {
			// Not a Nest provider: class-validator's own default-container behaviour.
			instance = new someClass();
			this.instances.set(someClass, instance);
			return instance;
		}

		if (instance) {
			this.instances.set(someClass, instance);
		}
		return instance;
	}
}
