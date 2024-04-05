import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeLevel } from '../employee-level.entity';

@Injectable()
export class TypeOrmEmployeeLevelRepository extends Repository<EmployeeLevel> {
    constructor(@InjectRepository(EmployeeLevel) readonly repository: Repository<EmployeeLevel>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
