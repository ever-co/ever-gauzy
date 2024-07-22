import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { Proposal } from '../proposal.entity';

export class MikroOrmProposalRepository extends MikroOrmBaseEntityRepository<Proposal> { }
