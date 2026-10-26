/**
 * Memoise class-transformer's metadata lookups.
 *
 * `instanceToPlain` runs on every REST response (TransformInterceptor), and for every object in the response graph
 * class-transformer asks its `MetadataStorage` which properties are exposed / excluded (`getMetadata`: a copy and
 * filter of the target's map plus one per ancestor) and, per property, for expose / exclude / type / transform
 * metadata (`findMetadata`, `findMetadatas`: a walk over the ancestors). A page of 10 employees with their users
 * and images is a few hundred such lookups; measured at ~3% of the API's CPU under load.
 *
 * The answers depend only on the decorators, which are registered while the classes load. Each lookup is now
 * cached per (metadata map, target, property) and every cache is dropped whenever metadata is added or cleared, so
 * a class registered later is seen exactly as before. Cached arrays are handed out as copies, as the original
 * returned fresh arrays. Applies only to the implementation it was written against (class-transformer 0.5,
 * checked by fingerprint); `CLASS_TRANSFORMER_MEMOIZE_METADATA=false` disables it.
 */

let applied = false;

export function applyClassTransformerMetadataPatches(env: NodeJS.ProcessEnv = process.env): boolean {
	if (
		String(env.CLASS_TRANSFORMER_MEMOIZE_METADATA ?? '')
			.trim()
			.toLowerCase() === 'false'
	) {
		return false;
	}
	if (applied) {
		return true;
	}
	let storage: any;
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		storage = require('class-transformer/cjs/storage').defaultMetadataStorage;
	} catch {
		return false;
	}
	const prototype = storage ? Object.getPrototypeOf(storage) : undefined;
	const names = ['getMetadata', 'findMetadata', 'findMetadatas'] as const;
	const mutators = [
		'addTypeMetadata',
		'addTransformMetadata',
		'addExposeMetadata',
		'addExcludeMetadata',
		'clear'
	] as const;
	if (!prototype || [...names, ...mutators].some((name) => typeof prototype[name] !== 'function')) {
		return false;
	}
	const getMetadataSource = Function.prototype.toString.call(prototype.getMetadata);
	if (!getMetadataSource.includes('getAncestors') || !getMetadataSource.includes('metadataFromAncestors')) {
		return false;
	}

	let generation = 0;
	for (const name of mutators) {
		const original = prototype[name];
		prototype[name] = function patchedMutator(this: any, ...args: unknown[]) {
			generation++;
			return original.apply(this, args);
		};
	}

	// metadatas map → target → (propertyName → result); `getMetadata` has no property, keyed under a symbol.
	type Entry = { generation: number; value: unknown };
	const caches = new WeakMap<object, WeakMap<object, Map<unknown, Entry>>>();
	const NO_PROPERTY = Symbol('no property');

	const memoise = (name: (typeof names)[number], copy: boolean) => {
		const original = prototype[name];
		prototype[name] = function patchedLookup(this: any, metadatas: object, target: object, propertyName?: unknown) {
			if (!metadatas || (typeof target !== 'function' && typeof target !== 'object') || target === null) {
				return original.call(this, metadatas, target, propertyName);
			}
			let byTarget = caches.get(metadatas);
			if (!byTarget) caches.set(metadatas, (byTarget = new WeakMap()));
			let byProperty = byTarget.get(target);
			if (!byProperty) byTarget.set(target, (byProperty = new Map()));
			const key = propertyName === undefined && name === 'getMetadata' ? NO_PROPERTY : propertyName;
			const hit = byProperty.get(key);
			if (hit && hit.generation === generation) {
				return copy ? (hit.value as unknown[]).slice() : hit.value;
			}
			const value = original.call(this, metadatas, target, propertyName);
			byProperty.set(key, { generation, value });
			return copy ? (value as unknown[]).slice() : value;
		};
	};
	memoise('getMetadata', true);
	memoise('findMetadata', false);
	memoise('findMetadatas', true);

	applied = true;
	return true;
}
