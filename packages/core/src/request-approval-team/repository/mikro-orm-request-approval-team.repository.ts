import { EntityRepository } from '@mikro-orm/core';
import { RequestApprovalTeam } from '../request-approval-team.entity';

export class MikroOrmRequestApprovalTeamRepository extends EntityRepository<RequestApprovalTeam> { }