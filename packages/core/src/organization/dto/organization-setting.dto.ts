import { PickType } from '@nestjs/swagger';
import { Organization } from '../organization.entity';

/**
 * Organization Setting DTO validation
 */
export class OrganizationSettingDTO extends PickType(Organization, [
	'defaultValueDateType',
	'startWeekOn',
	'inviteExpiryPeriod',
	'regionCode'
] as const) {}
