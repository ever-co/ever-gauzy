import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeePhone } from '../employee-phone.entity';

@Injectable()
export class TypeOrmEmployeePhoneRepository extends Repository<EmployeePhone> {
    constructor(@InjectRepository(EmployeePhone) readonly repository: Repository<EmployeePhone>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
