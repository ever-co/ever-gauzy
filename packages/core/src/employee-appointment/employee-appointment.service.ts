import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { sign, decode } from 'jsonwebtoken';
import { IEmployeeAppointmentCreateInput } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmEmployeeAppointmentRepository } from './repository/type-orm-employee-appointment.repository';
import { MikroOrmEmployeeAppointmentRepository } from './repository/mikro-orm-employee-appointment.repository';
import { EmployeeAppointment } from './employee-appointment.entity';

@Injectable()
export class EmployeeAppointmentService extends TenantAwareCrudService<EmployeeAppointment> {
	constructor(
		@InjectRepository(EmployeeAppointment)
		typeOrmEmployeeAppointmentRepository: TypeOrmEmployeeAppointmentRepository,

		mikroOrmEmployeeAppointmentRepository: MikroOrmEmployeeAppointmentRepository
	) {
		super(typeOrmEmployeeAppointmentRepository, mikroOrmEmployeeAppointmentRepository);
	}

	/**
	 *
	 * @param employeeAppointmentRequest
	 * @returns
	 */
	async saveAppointment(employeeAppointmentRequest: IEmployeeAppointmentCreateInput): Promise<EmployeeAppointment> {
		return await this.typeOrmRepository.save(employeeAppointmentRequest);
	}

	/**
	 *
	 * @param id
	 * @returns
	 */
	signAppointmentId(id: string) {
		return sign(
			{
				appointmentId: id
			},
			env.JWT_SECRET,
			{}
		);
	}

	/**
	 *
	 * @param token
	 * @returns
	 */
	decode(token: string) {
		return decode(token);
	}
}
