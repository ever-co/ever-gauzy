/**
 * The measurement families the platform seeds, and the reference unit each one defines.
 *
 * A family's `code` is **tenant data**, not an enumeration: a packaging family ("sleeve of 6",
 * "pallet of 480") is the tenant's own word for its own container, and a closed TypeScript enum
 * would make every one of them a release. What is fixed is only the **physical** set below, which is
 * seeded per organization because a quantity with no family is a bare number.
 *
 * The reference of each seeded family is its **smallest** unit, which is what keeps every factor a
 * multiplier greater than or equal to one. That property is load-bearing rather than stylistic: with
 * it, converting to a coarser unit is a multiplication and an exact division by an integer, and the
 * packaging cases that dominate real data stay exact in `numeric(20,6)`.
 */

/** The machine key of a measurement family: `unit_category.code`. */
export const UnitCategoryCode = {
	COUNT: 'COUNT',
	MASS: 'MASS',
	LENGTH: 'LENGTH',
	VOLUME: 'VOLUME',
	AREA: 'AREA',
	TIME: 'TIME'
} as const;

/** The union of the seeded family codes. A tenant may declare further codes of its own. */
export type UnitCategoryCode = (typeof UnitCategoryCode)[keyof typeof UnitCategoryCode];

/** The reference unit each seeded family defines, by `unit_category.code`. */
export const UNIT_CATEGORY_REFERENCE_CODE: Readonly<Record<UnitCategoryCode, string>> = {
	[UnitCategoryCode.COUNT]: 'PIECE',
	[UnitCategoryCode.MASS]: 'GRAM',
	[UnitCategoryCode.LENGTH]: 'MILLIMETRE',
	[UnitCategoryCode.VOLUME]: 'MILLILITRE',
	[UnitCategoryCode.AREA]: 'SQUARE_MILLIMETRE',
	[UnitCategoryCode.TIME]: 'SECOND'
};

/** The seeded family codes, as a flat array. */
export const SEEDED_UNIT_CATEGORY_CODES: readonly UnitCategoryCode[] =
	Object.values(UnitCategoryCode);
