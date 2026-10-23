import { getMetadataStorage } from 'class-validator';

/**
 * Memoise class-validator's inheritance scan.
 *
 * `MetadataStorage.getTargetValidationMetadatas` runs for every `validate()` — i.e. for every validated DTO of every
 * request — and, to find the metadata a DTO inherits, loops over EVERY class that ever registered a validation
 * decorator and tests `targetConstructor.prototype instanceof key`. This monorepo registers well over a thousand
 * such classes (DTOs, entities, plugin DTOs), so each validation walked the whole map with a prototype-chain test
 * per entry: 3.6% of the API's CPU in a profile under load, for an answer that never changes once the classes
 * are loaded.
 *
 * The ancestors of a target (the keys whose prototype it inherits) are now computed once per target and
 * recomputed only when a NEW target registers metadata (decorators run while modules load; `addValidationSchema`
 * can add one later). Everything else — the per-group / `always` / strict-groups filtering, duplicate removal,
 * ordering — is the original algorithm, applied to the same metadata arrays read live from the map (so a decorator
 * added to a known class later is seen too). The patch applies only to the implementation it was written against
 * (class-validator 0.15, checked by fingerprint) and `CLASS_VALIDATOR_MEMOIZE_ANCESTORS=false` disables it.
 */

let applied = false;

export function applyClassValidatorMetadataPatches(env: NodeJS.ProcessEnv = process.env): boolean {
	if (
		String(env.CLASS_VALIDATOR_MEMOIZE_ANCESTORS ?? '')
			.trim()
			.toLowerCase() === 'false'
	) {
		return false;
	}
	if (applied) {
		return true;
	}
	const storage: any = getMetadataStorage();
	const prototype = Object.getPrototypeOf(storage);
	const original: Function | undefined = prototype?.getTargetValidationMetadatas;
	const originalAdd: Function | undefined = prototype?.addValidationMetadata;
	if (typeof original !== 'function' || typeof originalAdd !== 'function' || original.length !== 5) {
		return false;
	}
	const source = Function.prototype.toString.call(original);
	// The exact algorithm replicated below; anything else is left alone.
	if (
		!source.includes('targetConstructor.prototype instanceof key') ||
		!source.includes('uniqueInheritedMetadatas') ||
		!source.includes('excludeMetadataBecauseOfStrictGroupsOption')
	) {
		return false;
	}

	// Bumped whenever a target registers metadata for the first time: the ancestor lists depend on the set of keys.
	let generation = 0;
	const ancestorsOf = new WeakMap<Function, { generation: number; ancestors: Function[] }>();

	prototype.addValidationMetadata = function patchedAddValidationMetadata(this: any, metadata: any) {
		if (!this.validationMetadatas?.has?.(metadata?.target)) {
			generation++;
		}
		return originalAdd.call(this, metadata);
	};

	prototype.getTargetValidationMetadatas = function patchedGetTargetValidationMetadatas(
		this: any,
		targetConstructor: Function,
		targetSchema: string,
		always: boolean,
		strictGroups: boolean,
		groups?: string[]
	) {
		const includeMetadataBecauseOfAlwaysOption = (metadata: any): boolean => {
			if (typeof metadata.always !== 'undefined') return metadata.always;
			if (metadata.groups && metadata.groups.length) return false;
			return always;
		};
		const excludeMetadataBecauseOfStrictGroupsOption = (metadata: any): boolean => {
			if (strictGroups) {
				if (!groups || !groups.length) {
					if (metadata.groups && metadata.groups.length) return true;
				}
			}
			return false;
		};

		const filteredForOriginalMetadatasSearch: any[] = this.validationMetadatas.get(targetConstructor) || [];
		const originalMetadatas = filteredForOriginalMetadatasSearch.filter((metadata: any) => {
			if (metadata.target !== targetConstructor && metadata.target !== targetSchema) return false;
			if (includeMetadataBecauseOfAlwaysOption(metadata)) return true;
			if (excludeMetadataBecauseOfStrictGroupsOption(metadata)) return false;
			if (groups && groups.length > 0) {
				return metadata.groups && !!metadata.groups.find((group: string) => groups.indexOf(group) !== -1);
			}
			return true;
		});

		// The one memoised step: which registered targets this one inherits from.
		let ancestors: Function[];
		const cached = typeof targetConstructor === 'function' ? ancestorsOf.get(targetConstructor) : undefined;
		if (cached && cached.generation === generation) {
			ancestors = cached.ancestors;
		} else {
			ancestors = [];
			for (const key of this.validationMetadatas.keys()) {
				if (targetConstructor.prototype instanceof key) {
					ancestors.push(key);
				}
			}
			if (typeof targetConstructor === 'function') {
				ancestorsOf.set(targetConstructor, { generation, ancestors });
			}
		}
		const filteredForInheritedMetadatasSearch: any[] = [];
		for (const key of ancestors) {
			const value = this.validationMetadatas.get(key);
			if (value) filteredForInheritedMetadatasSearch.push(...value);
		}

		const inheritedMetadatas = filteredForInheritedMetadatasSearch.filter((metadata: any) => {
			if (typeof metadata.target === 'string') return false;
			if (metadata.target === targetConstructor) return false;
			if (metadata.target instanceof Function && !(targetConstructor.prototype instanceof metadata.target)) {
				return false;
			}
			if (includeMetadataBecauseOfAlwaysOption(metadata)) return true;
			if (excludeMetadataBecauseOfStrictGroupsOption(metadata)) return false;
			if (groups && groups.length > 0) {
				return metadata.groups && !!metadata.groups.find((group: string) => groups.indexOf(group) !== -1);
			}
			return true;
		});
		const uniqueInheritedMetadatas = inheritedMetadatas.filter((inheritedMetadata: any) => {
			return !originalMetadatas.find((originalMetadata: any) => {
				return (
					originalMetadata.propertyName === inheritedMetadata.propertyName &&
					originalMetadata.type === inheritedMetadata.type
				);
			});
		});
		return originalMetadatas.concat(uniqueInheritedMetadatas);
	};

	applied = true;
	return true;
}
