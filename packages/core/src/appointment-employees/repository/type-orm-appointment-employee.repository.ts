import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AppointmentEmployee } from '../appointment-employees.entity';

@Injectable()
export class TypeOrmAppointmentEmployeeRepository extends Repository<AppointmentEmployee> {
    constructor(@InjectRepository(AppointmentEmployee) readonly repository: Repository<AppointmentEmployee>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
