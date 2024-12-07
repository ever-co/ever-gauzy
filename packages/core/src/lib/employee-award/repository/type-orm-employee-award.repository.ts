import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeAward } from '../employee-award.entity';

@Injectable()
export class TypeOrmEmployeeAwardRepository extends Repository<EmployeeAward> {
    constructor(@InjectRepository(EmployeeAward) readonly repository: Repository<EmployeeAward>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
