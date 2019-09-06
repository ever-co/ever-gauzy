import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSetting } from './employee-setting.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class EmployeeSettingService extends CrudService<EmployeeSetting> {
    constructor(@InjectRepository(EmployeeSetting) private readonly employeeSettingRepository: Repository<EmployeeSetting>) {
        super(employeeSettingRepository);
    }
}
