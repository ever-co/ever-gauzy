import { IOrganizationDurationRoundingSetting } from '@gauzy/contracts';
import { isNotNullOrUndefined } from '@gauzy/utils';

/**
 * Whether a write sets a duration rounding rule by either of its values: then the interval and the direction are both
 * required and checked. A write that sends neither, or both null to turn the rule off, sets none.
 *
 * @param organization The organization write being validated.
 * @returns `true` when the interval or the direction carries a value.
 */
export function setsDurationRoundingRule(organization: IOrganizationDurationRoundingSetting): boolean {
	const setsInterval = isNotNullOrUndefined(organization.durationRoundingInterval);
	const setsDirection = isNotNullOrUndefined(organization.durationRoundingDirection);
	return setsInterval || setsDirection;
}
