/**
 * The measurement families the platform seeds, and the reference unit that defines each one.
 *
 * **One definition, read by both paths that write it.** Two migrations seed these rows: the
 * fresh-install seed in `SeedCoreDefaults1791000000520`, and
 * `SeedMeasurementFamilies1791000000185`, which exists because an installation whose schema predates
 * `unit_category` and `unit` had that step skipped and a recorded migration is never retried. The
 * catalogue lives here rather than in either migration for the same reason `DEFAULT_FEATURES` lives
 * in `feature/default-features.ts`: two hand-maintained copies of one catalogue disagree the first
 * time either is edited, and the disagreement is invisible because both paths produce plausible rows.
 * The fresh-install seed also survives a re-run, so a family this list omits is not merely absent on a
 * new installation — it is absent from every installation, for ever.
 *
 * **The reference of every family is its smallest unit.** Each unit states one absolute `factor`
 * against its family's reference, so a family's arithmetic is a multiplication and an exact division
 * by an integer, which is what keeps the packaging cases that dominate real data exact in
 * `numeric(20,6)`. A reference larger than one of its siblings would invert that.
 *
 * **Packaging vocabulary is deliberately absent.** "Sleeve of 6" and "pallet of 480" are the tenant's
 * own words for its own containers, so they are data a tenant declares, never a platform fact — the
 * same boundary `measurement.constants.ts` draws when it says a family's code is tenant data.
 */

/**
 * One physical measurement family and the reference unit that defines it.
 *
 * The shape is the seed's own and is exported so that both seeding paths write the same columns from
 * the same values, rather than each restating the field list.
 */
export interface ISeedUnitFamily {
	/** `unit_category.code` — `COUNT` / `MASS` / `LENGTH` / `VOLUME` / `AREA` / `TIME`. */
	category: string;
	/** `unit_category.name`. */
	categoryName: string;
	/** The reference unit's `code`. */
	reference: string;
	/** The reference unit's `name`. */
	referenceName: string;
	/** Display suffix; null falls back to the code. */
	symbol: string;
	/** Quantity granularity of the reference unit, per the schema specification. */
	decimalPlaces: number;
}

/**
 * The physical measurement families, in the order they are seeded.
 *
 * `COUNT` is first because it is the family a quantity means when nobody has said otherwise: every
 * quantity an installation already holds is a count of things, which is what makes the variant
 * backfill both paths perform a derivation rather than a guess.
 */
export const DEFAULT_UNIT_FAMILIES: ISeedUnitFamily[] = [
	{ category: 'COUNT', categoryName: 'Count', reference: 'PIECE', referenceName: 'Piece', symbol: 'pc', decimalPlaces: 0 },
	{ category: 'MASS', categoryName: 'Mass', reference: 'GRAM', referenceName: 'Gram', symbol: 'g', decimalPlaces: 3 },
	{ category: 'LENGTH', categoryName: 'Length', reference: 'MILLIMETRE', referenceName: 'Millimetre', symbol: 'mm', decimalPlaces: 1 },
	{ category: 'VOLUME', categoryName: 'Volume', reference: 'MILLILITRE', referenceName: 'Millilitre', symbol: 'ml', decimalPlaces: 3 },
	{ category: 'AREA', categoryName: 'Area', reference: 'SQUARE_MILLIMETRE', referenceName: 'Square millimetre', symbol: 'mm2', decimalPlaces: 1 },
	{ category: 'TIME', categoryName: 'Time', reference: 'SECOND', referenceName: 'Second', symbol: 's', decimalPlaces: 3 }
];

/**
 * The `tenant_setting` keys that point at the seeded reference of a family.
 *
 * Only the three families a document can state as a measure of goods are pointed at: a count, a
 * length and a volume are what a pick list, a packing slip or a capacity check resolves a bare number
 * through. Mass, area and time are seeded so that a quantity in them is expressible, and an operator
 * who wants a default for one of those declares it.
 *
 * The value written is the **reference unit's id**, so a tenant that later re-points a setting at a
 * unit of its own keeps that decision: the seed only inserts a key that is absent, and a rollback
 * only removes a key that still names a unit the rollback is removing.
 */
export const DEFAULT_UNIT_REFERENCE_SETTING_KEYS: Array<{ name: string; category: string }> = [
	{ name: 'measure.default.massUnitId', category: 'MASS' },
	{ name: 'measure.default.lengthUnitId', category: 'LENGTH' },
	{ name: 'measure.default.volumeUnitId', category: 'VOLUME' }
];
