import { EntityRepository } from '@mikro-orm/knex';
import { ReportOrganization } from '../report-organization.entity';

export class MikroOrmReportOrganizationRepository extends EntityRepository<ReportOrganization> { }
