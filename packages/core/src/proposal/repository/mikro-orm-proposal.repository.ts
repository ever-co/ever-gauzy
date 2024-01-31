import { EntityRepository } from '@mikro-orm/core';
import { Proposal } from '../proposal.entity';

export class MikroOrmProposalRepository extends EntityRepository<Proposal> { }