import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Proposal } from '../proposal.entity';

export class MikroOrmProposalRepository extends MikroOrmBaseEntityRepository<Proposal> { }
