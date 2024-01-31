import { EntityRepository } from '@mikro-orm/core';
import { ReportOrganization } from '../report-organization.entity';

export class MikroOrmReportOrganizationRepository extends EntityRepository<ReportOrganization> { }
