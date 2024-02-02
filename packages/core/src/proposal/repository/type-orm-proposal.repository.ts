import { Repository } from 'typeorm';
import { Proposal } from '../proposal.entity';

export class TypeOrmProposalRepository extends Repository<Proposal> { }