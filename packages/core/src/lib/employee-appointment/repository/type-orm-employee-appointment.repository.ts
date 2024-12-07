import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployeeAppointment } from '../employee-appointment.entity';

@Injectable()
export class TypeOrmEmployeeAppointmentRepository extends Repository<EmployeeAppointment> {
    constructor(@InjectRepository(EmployeeAppointment) readonly repository: Repository<EmployeeAppointment>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
