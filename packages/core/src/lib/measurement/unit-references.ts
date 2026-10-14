import { UnitCategoryCode } from './measurement.constants';

/**
 * One column that names a unit, and what the column's meaning requires of the unit it names.
 *
 * A reference is declared rather than inferred, because a column called `unitId` says only that a
 * unit is named — never *which* unit is allowed. The three requirements below are the ones a
 * set-based statement can decide, and they are the three a constraint cannot carry on every
 * dialect: a dangling reference, a family the column's meaning fixes, and a unit that must be its
 * family's reference.
 */
export interface IUnitReference {
	/** The table that owns the column. */
	readonly table: string;

	/** The column that names the unit. */
	readonly column: string;

	/** The capability that declares the reference: `core`, or the package name that ships it. */
	readonly owner: string;

	/**
	 * The measurement family the column's meaning fixes, as `unit_category.code`.
	 *
	 * Absent for a column that may name any family — a price's unit, or a line's unit of issue, is
	 * whatever the tenant priced or ordered in. Present for a column whose meaning is one physical
	 * quantity: a weight ceiling is a mass or it is nothing, and a stated family is what lets the
	 * audit answer "is this number what it says it is" without reading the tenant's intent.
	 */
	readonly category?: UnitCategoryCode | string;

	/**
	 * Another column of the same row whose unit must be in the same family as this one.
	 *
	 * A variant is stocked, sold and bought in one family and no other: conversion is defined only
	 * inside a family, so a variant whose sales unit is a mass while its stock unit is a count cannot
	 * be transacted at all, and the failure would otherwise surface at the first order rather than at
	 * the row that caused it.
	 */
	readonly sameCategoryAs?: string;

	/**
	 * Whether the unit must be its family's **reference** unit.
	 *
	 * Only `product_variant.stockUnitId` requires this, and it is load-bearing rather than
	 * stylistic: the stock ledger keeps one number per level, so that number is only additive if
	 * every level of every variant is stated in the same kind of unit — which is exactly the
	 * reference of each family.
	 */
	readonly referenceUnit?: boolean;

	/** What the column means, in one line, for the report a person reads. */
	readonly description: string;
}

/**
 * The kernel's own unit references.
 *
 * The product variant is the kernel's table, so its four references are declared here. A package
 * that adds a unit reference to a table of its own declares it the same way and registers it at
 * bootstrap, which is what keeps this list from becoming a kernel copy of every package's schema:
 * the kernel owns the rule, the package owns the column, and `registerUnitReferences` is where the
 * two meet.
 */
export const KERNEL_UNIT_REFERENCES: readonly IUnitReference[] = [
	{
		table: 'product_variant',
		column: 'stockUnitId',
		owner: 'core',
		referenceUnit: true,
		description: "A variant's stock unit, which must be its family's reference unit."
	},
	{
		table: 'product_variant',
		column: 'salesUnitId',
		owner: 'core',
		sameCategoryAs: 'stockUnitId',
		description: "A variant's sales unit, which must be in the family it is stocked in."
	},
	{
		table: 'product_variant',
		column: 'purchaseUnitId',
		owner: 'core',
		sameCategoryAs: 'stockUnitId',
		description: "A variant's purchase unit, which must be in the family it is stocked in."
	},
	{
		table: 'product_variant',
		column: 'weightUnitId',
		owner: 'core',
		category: UnitCategoryCode.MASS,
		description: "A variant's shipping weight unit, which is a unit of mass and nothing else."
	}
];

/**
 * The references declared so far, keyed by the column they describe.
 *
 * The kernel's own list is the starting point and is not removable: a package may add a reference,
 * never replace one, because replacing it would silently change what a column of a table the package
 * does not own is allowed to hold.
 */
const declared = new Map<string, IUnitReference>();

/** @param reference A reference. @returns Its key: the table and the column, which identify it. */
function keyOf(reference: Pick<IUnitReference, 'table' | 'column'>): string {
	return `${reference.table}.${reference.column}`;
}

for (const reference of KERNEL_UNIT_REFERENCES) {
	declared.set(keyOf(reference), reference);
}

/**
 * Declares unit references a package owns.
 *
 * Registering the same reference twice is a no-op, because a plugin loaded twice must declare once.
 * The capability that owns a column may revise its own declaration — a later call under the same
 * owner replaces the earlier one, which is what makes the registry's contents a function of which
 * packages are loaded rather than of the order they were loaded in. A *different* capability
 * declaring a column that is already described is an error: two descriptions of one column would
 * make the audit's answer depend on plugin order, and the column would be reported clean or dirty
 * according to which package happened to load first.
 *
 * A package calls this from its bootstrap hook, so the declaration exists before the first audit
 * runs — the audit is a nightly job and reads the registry at the moment it runs, which is what lets
 * a plugin that is not installed contribute nothing at all.
 *
 * @param references The references to declare.
 * @throws Error when a column is already described by a different capability.
 */
export function registerUnitReferences(references: readonly IUnitReference[]): void {
	for (const reference of references) {
		if (!reference?.table || !reference?.column) {
			throw new Error('A unit reference must name the table and the column it describes.');
		}

		const key = keyOf(reference);
		const existing = declared.get(key);

		if (existing && existing.owner !== reference.owner) {
			throw new Error(
				`The unit reference "${key}" is already declared by ${existing.owner}, so ${reference.owner} cannot redeclare it.`
			);
		}

		declared.set(key, reference);
	}
}

/**
 * Every declared unit reference.
 *
 * @returns The references, ordered by table and then by column so a report reads the same way twice.
 */
export function registeredUnitReferences(): readonly IUnitReference[] {
	return [...declared.values()].sort((left, right) =>
		left.table === right.table ? left.column.localeCompare(right.column) : left.table.localeCompare(right.table)
	);
}

/**
 * Removes a package's declarations.
 *
 * Exists for the tests that prove a package's declarations are its own, and for a plugin unloaded
 * from a running process. It refuses to remove a kernel reference, because the kernel's columns are
 * not a package's to withdraw.
 *
 * @param owner The capability whose declarations are withdrawn.
 * @returns The number of references withdrawn.
 */
export function withdrawUnitReferences(owner: string): number {
	let withdrawn = 0;

	for (const [key, reference] of declared) {
		if (reference.owner === owner) {
			declared.delete(key);
			withdrawn++;
		}
	}

	return withdrawn;
}
