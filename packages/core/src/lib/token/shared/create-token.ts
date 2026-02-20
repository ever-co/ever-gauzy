/**
 * Create a named unique token for dependency injection.
 * The returned value is a `symbol` but carries a tiny phantom type
 * so consumers get better autocomplete/intent while remaining a runtime
 * unique symbol.
 */
export function createToken<Name extends string>(name: Name) {
	return Symbol(name) as symbol & { readonly __token?: Name };
}
