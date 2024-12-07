import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deal } from '../deal.entity';

@Injectable()
export class TypeOrmDealRepository extends Repository<Deal> {
    constructor(@InjectRepository(Deal) readonly repository: Repository<Deal>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
