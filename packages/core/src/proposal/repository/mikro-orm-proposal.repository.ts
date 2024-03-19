import { EntityRepository } from '@mikro-orm/knex';
import { Proposal } from '../proposal.entity';

export class MikroOrmProposalRepository extends EntityRepository<Proposal> { }
