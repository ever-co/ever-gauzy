import { CrudService, IPagination } from '../core';
import { EmployeeAppointment } from './employee-appointment.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { IEmployeeAppointmentCreateInput } from '@gauzy/models';
import { environment as env } from '@env-api/environment';
import { sign, decode } from 'jsonwebtoken';

@Injectable()
export class EmployeeAppointmentService extends CrudService<
	EmployeeAppointment
> {
	constructor(
		@InjectRepository(EmployeeAppointment)
		private readonly employeeAppointmentRepository: Repository<
			EmployeeAppointment
		>
	) {
		super(employeeAppointmentRepository);
	}

	async findAllAppointments(
		filter?: FindManyOptions<EmployeeAppointment>
	): Promise<IPagination<EmployeeAppointment>> {
		const total = await this.employeeAppointmentRepository.count(filter);
		const items = await this.employeeAppointmentRepository.find(filter);

		return { items, total };
	}

	async saveAppointment(
		employeeAppointmentRequest: IEmployeeAppointmentCreateInput
	): Promise<EmployeeAppointment> {
		return await this.employeeAppointmentRepository.save(
			employeeAppointmentRequest
		);
	}

	async signAppointmentId(id: string) {
		return await sign(
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
