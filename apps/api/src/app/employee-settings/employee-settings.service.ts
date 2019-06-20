import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSettings } from './employee-settings.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class EmployeeSettingsService extends CrudService<EmployeeSettings> {
    constructor(@InjectRepository(EmployeeSettings) private readonly employeeSettingsRepository: Repository<EmployeeSettings>) {
        super(employeeSettingsRepository);
    }
}
