import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeSettings } from './employee-settings.entity';

@Injectable()
export class EmployeeSettingsService {
    constructor(@InjectRepository(EmployeeSettings) private readonly employeeSettingsRepository: Repository<EmployeeSettings>) {
    }
}
