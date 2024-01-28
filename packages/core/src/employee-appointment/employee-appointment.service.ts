import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { EmployeeAppointment } from './employee-appointment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { IEmployeeAppointmentCreateInput } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { sign, decode } from 'jsonwebtoken';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class EmployeeAppointmentService extends TenantAwareCrudService<EmployeeAppointment> {
	constructor(
		@InjectRepository(EmployeeAppointment)
		employeeAppointmentRepository: Repository<EmployeeAppointment>,
		@MikroInjectRepository(EmployeeAppointment)
		mikroEmployeeAppointmentRepository: EntityRepository<EmployeeAppointment>
	) {
		super(employeeAppointmentRepository, mikroEmployeeAppointmentRepository);
	}

	async saveAppointment(employeeAppointmentRequest: IEmployeeAppointmentCreateInput): Promise<EmployeeAppointment> {
		return await this.repository.save(employeeAppointmentRequest);
	}

	signAppointmentId(id: string) {
		return sign(
			{
				appointmentId: id
			},
			env.JWT_SECRET,
			{}
		);
	}

	decode(token: string) {
		return decode(token);
	}
}
