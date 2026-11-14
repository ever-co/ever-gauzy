import { IOrganizationDurationRoundingSetting } from '@gauzy/contracts';

/**
 * Whether a write sets a duration rounding rule: then the interval and the direction are both required and checked. A
 * write that sends neither, or both null to turn the rule off, sets none. A write that sends one of them alone, even
 * null, sets one, so that half a rule is never stored.
 *
 * @param organization The organization write being validated.
 * @returns `true` when the write sends the interval or the direction, unless it sends both null.
 */
export function setsDurationRoundingRule(organization: IOrganizationDurationRoundingSetting): boolean {
	const { durationRoundingInterval: interval, durationRoundingDirection: direction } = organization;
	const sendsInterval = interval !== undefined;
	const sendsDirection = direction !== undefined;
	const sendsEither = sendsInterval || sendsDirection;
	const turnsRuleOff = interval === null && direction === null;
	return sendsEither && !turnsRuleOff;
}
