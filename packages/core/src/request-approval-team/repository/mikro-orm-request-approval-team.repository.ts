import { EntityRepository } from '@mikro-orm/knex';
import { RequestApprovalTeam } from '../request-approval-team.entity';

export class MikroOrmRequestApprovalTeamRepository extends EntityRepository<RequestApprovalTeam> { }
