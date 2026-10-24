/**
 * The 3-way merge per field (plan 03 §C.5). Pure functions.
 *
 * `S` is the snapshot (the last agreed value), `G` the current Gauzy value and `E` the incoming Ever
 * Works value. Only one side changed → take it. Both changed to the same value → no-op. Both changed:
 * scalars and rich text → last writer wins (tie → Ever Works), logged as a conflict, and for rich text
 * the losing version is kept by the caller (a comment or a document version); sets → (S − removed by
 * either) ∪ added by either. Status is not merged here: Ever Works' gates decide it (§C.3).
 */

export type FieldKind = 'scalar' | 'set' | 'richText';

export interface FieldSpec {
	kind: FieldKind;
}

/** The outcome of one field. */
export interface FieldMergeResult<T = unknown> {
	value: T;
	/** Who the merged value came from. */
	source: 'none' | 'gauzy' | 'ever_works' | 'both' | 'merged';
	/** Both sides changed to different values. */
	conflict: boolean;
	/** For a conflict on a scalar or rich text: the value that lost (kept by the caller). */
	loser?: T;
	loserSide?: 'gauzy' | 'ever_works';
}

/** Deep equality for JSON-like values (arrays in order, objects by key). */
export function sameValue(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null || a === undefined || b === undefined) return (a ?? null) === (b ?? null);
	if (a instanceof Date || b instanceof Date) {
		return new Date(a as string).getTime() === new Date(b as string).getTime();
	}
	if (typeof a !== 'object' || typeof b !== 'object') return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((value, i) => sameValue(value, b[i]));
	}
	const ka = Object.keys(a as object).sort();
	const kb = Object.keys(b as object).sort();
	return sameValue(ka, kb) && ka.every((key) => sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/** Set equality on string members (order and duplicates ignored). */
export function sameSet(a: ReadonlyArray<string> | null | undefined, b: ReadonlyArray<string> | null | undefined): boolean {
	const sa = new Set(a ?? []);
	const sb = new Set(b ?? []);
	return sa.size === sb.size && [...sa].every((value) => sb.has(value));
}

/** (S − removed by either side) ∪ added by either side, in a stable order (snapshot order, then additions). */
export function mergeSets(snapshot: ReadonlyArray<string>, gauzy: ReadonlyArray<string>, everWorks: ReadonlyArray<string>): string[] {
	const s = new Set(snapshot);
	const g = new Set(gauzy);
	const e = new Set(everWorks);
	const kept = snapshot.filter((value) => g.has(value) && e.has(value));
	const added = [...gauzy, ...everWorks].filter((value) => !s.has(value));
	return [...new Set([...kept, ...added])];
}

/**
 * Merges one field. `gauzyAt` / `everWorksAt` are the change times used for last-writer-wins (Gauzy's
 * `updatedAt`, Ever Works' event `occurredAt`); a tie, or a missing time, goes to Ever Works.
 */
export function mergeField<T>(
	spec: FieldSpec,
	snapshot: T,
	gauzy: T,
	everWorks: T,
	gauzyAt?: Date | string | null,
	everWorksAt?: Date | string | null
): FieldMergeResult<T> {
	if (spec.kind === 'set') {
		const s = (snapshot as unknown as string[]) ?? [];
		const g = (gauzy as unknown as string[]) ?? [];
		const e = (everWorks as unknown as string[]) ?? [];
		const gChanged = !sameSet(s, g);
		const eChanged = !sameSet(s, e);
		if (!gChanged && !eChanged) return { value: snapshot, source: 'none', conflict: false };
		if (gChanged && !eChanged) return { value: gauzy, source: 'gauzy', conflict: false };
		if (!gChanged && eChanged) return { value: everWorks, source: 'ever_works', conflict: false };
		if (sameSet(g, e)) return { value: everWorks, source: 'both', conflict: false };
		return { value: mergeSets(s, g, e) as unknown as T, source: 'merged', conflict: false };
	}
	const gChanged = !sameValue(snapshot, gauzy);
	const eChanged = !sameValue(snapshot, everWorks);
	if (!gChanged && !eChanged) return { value: snapshot, source: 'none', conflict: false };
	if (gChanged && !eChanged) return { value: gauzy, source: 'gauzy', conflict: false };
	if (!gChanged && eChanged) return { value: everWorks, source: 'ever_works', conflict: false };
	if (sameValue(gauzy, everWorks)) return { value: everWorks, source: 'both', conflict: false };
	const g = gauzyAt ? new Date(gauzyAt).getTime() : Number.NaN;
	const e = everWorksAt ? new Date(everWorksAt).getTime() : Number.NaN;
	const gauzyWins = Number.isFinite(g) && (!Number.isFinite(e) || g > e);
	return gauzyWins
		? { value: gauzy, source: 'gauzy', conflict: true, loser: everWorks, loserSide: 'ever_works' }
		: { value: everWorks, source: 'ever_works', conflict: true, loser: gauzy, loserSide: 'gauzy' };
}

/** Merges a record of fields; returns the merged values, the conflicts and what each side must apply. */
export function mergeRecord<R extends Record<string, unknown>>(
	specs: Record<keyof R & string, FieldSpec>,
	snapshot: Partial<R>,
	gauzy: Partial<R>,
	everWorks: Partial<R>,
	times: { gauzyAt?: Date | string | null; everWorksAt?: Date | string | null } = {}
): {
	merged: Partial<R>;
	conflicts: Array<{ field: keyof R & string; result: FieldMergeResult }>;
	/** Fields whose merged value differs from Gauzy's (apply them in Gauzy). */
	toGauzy: Array<keyof R & string>;
	/** Fields whose merged value differs from Ever Works' (push them). */
	toEverWorks: Array<keyof R & string>;
} {
	const merged: Partial<R> = {};
	const conflicts: Array<{ field: keyof R & string; result: FieldMergeResult }> = [];
	const toGauzy: Array<keyof R & string> = [];
	const toEverWorks: Array<keyof R & string> = [];
	for (const field of Object.keys(specs) as Array<keyof R & string>) {
		const spec = specs[field];
		const result = mergeField(spec, snapshot[field], gauzy[field], everWorks[field], times.gauzyAt, times.everWorksAt);
		merged[field] = result.value as R[typeof field];
		if (result.conflict) conflicts.push({ field, result });
		const same = spec.kind === 'set' ? (a: unknown, b: unknown) => sameSet(a as string[], b as string[]) : sameValue;
		if (!same(result.value, gauzy[field])) toGauzy.push(field);
		if (!same(result.value, everWorks[field])) toEverWorks.push(field);
	}
	return { merged, conflicts, toGauzy, toEverWorks };
}
