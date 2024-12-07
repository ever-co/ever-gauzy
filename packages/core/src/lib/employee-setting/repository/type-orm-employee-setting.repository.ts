import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSetting } from '../employee-setting.entity';

@Injectable()
export class TypeOrmEmployeeSettingRepository extends Repository<EmployeeSetting> {
    constructor(@InjectRepository(EmployeeSetting) readonly repository: Repository<EmployeeSetting>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
