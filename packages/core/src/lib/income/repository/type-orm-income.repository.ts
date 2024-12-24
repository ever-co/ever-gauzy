import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Income } from '../income.entity';

@Injectable()
export class TypeOrmIncomeRepository extends Repository<Income> {
    constructor(@InjectRepository(Income) readonly repository: Repository<Income>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
