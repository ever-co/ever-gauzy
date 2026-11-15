import { PickType } from '@nestjs/swagger';
import { Organization } from '../organization.entity';

/**
 * Organization Setting DTO validation
 */
export class OrganizationSettingDTO extends PickType(Organization, [
	'defaultValueDateType',
	'startWeekOn',
	'inviteExpiryPeriod',
	'regionCode',
	'allowEmployeeToSeeTrackedData',
	'allowScreenshotCapture',
	'requireTeam',
	'restrictTrackingSwitchToHigherRoles',
	'enforcePrivateProjects',
	'timeLogsKeepTheirRates',
	'defaultBillRateValue',
	'defaultBillRateCurrency',
	'durationRoundingInterval',
	'durationRoundingDirection',
	'requireTwoFactor',
	'allowDiscardTimer',
	'discardTimerWithinMinutes',
	'allowBreaks',
	'invoiceRemindersEnabled'
] as const) {}
