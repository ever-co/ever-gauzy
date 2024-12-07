import { PickType } from '@nestjs/swagger';
import { Organization } from '../organization.entity';

/**
 * Organization Bonuses DTO validation
 */
export class OrganizationBonusesDTO extends PickType(Organization, ['bonusPercentage', 'bonusType'] as const) {}
