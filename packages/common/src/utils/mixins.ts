/**
 * Mixins create partial classes which we can combine to form a single class that contains all the methods and properties from the partial classes.
 * @param derivedCtor
 * @param constructors
 * @returns {void}
 */
export function applyMixins(derivedCtor: any, constructors: any[]) {
	constructors.forEach((baseCtor) => {
		Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
			Object.defineProperty(
				derivedCtor.prototype,
				name,
				Object.getOwnPropertyDescriptor(baseCtor.prototype, name) ||
					Object.create(null)
			);
		});
	});
}
