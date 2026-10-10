import { PermissionsEnum } from '@gauzy/contracts';

/**
 * The permission pair this module owns, declared where the resource lives.
 *
 * Measurement is a platform resource rather than an administrative one, and the pair is deliberately
 * asymmetric. Reading it is not administrative — a warehouse operator needs the unit list to read a
 * pick list, and an accountant needs to know what a quantity means — while **editing it is**. A
 * unit's factor defines what every quantity expressed in it means: raising a `BOX` from 10 to 12
 * silently restates every stock level, movement and document line below the reference unit, and
 * `decimalPlaces` decides how finely a quantity may be stated at all. That is why `UNITS_EDIT` is the
 * narrower grant and why the two are separate rather than one `UNITS_MANAGE`.
 *
 * The values are members of the platform catalogue, not strings contributed at bootstrap: the kernel
 * owns them, and a resource declared in the kernel declares the catalogue entries it guards with
 * rather than the other way round.
 */
export const MEASUREMENT_PERMISSIONS = {
	/** Read measurement families and the units inside them, with their factors and their granularity. */
	UNITS_VIEW: PermissionsEnum.UNITS_VIEW,
	/** Create, update and archive families and units, and set a unit's factor, reference flag and granularity. */
	UNITS_EDIT: PermissionsEnum.UNITS_EDIT
} as const;
