import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Proposal } from '../proposal.entity';

@Injectable()
export class TypeOrmProposalRepository extends Repository<Proposal> {
    constructor(@InjectRepository(Proposal) readonly repository: Repository<Proposal>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
