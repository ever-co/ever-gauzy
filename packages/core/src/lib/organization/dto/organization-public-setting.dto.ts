import { PickType } from '@nestjs/swagger';
import { Organization } from '../organization.entity';

/**
 * Organization Public Setting DTO
 */
export class OrganizationPublicSettingDTO extends PickType(Organization, [
	'show_income',
	'show_profits',
	'show_bonuses_paid',
	'show_total_hours',
	'show_minimum_project_size',
	'show_projects_count',
	'show_clients_count',
	'show_clients',
	'show_employees_count'
]) {}
