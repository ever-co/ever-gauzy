import { Injectable } from '@nestjs/common';
import { sign, decode, JwtPayload } from 'jsonwebtoken';
import { ID, IEmployeeAppointment, IEmployeeAppointmentCreateInput } from '@gauzy/contracts';
import { environment as env } from '@gauzy/config';
import { TenantAwareCrudService } from './../core/crud';
import { TypeOrmEmployeeAppointmentRepository } from './repository/type-orm-employee-appointment.repository';
import { MikroOrmEmployeeAppointmentRepository } from './repository/mikro-orm-employee-appointment.repository';
import { EmployeeAppointment } from './employee-appointment.entity';

@Injectable()
export class EmployeeAppointmentService extends TenantAwareCrudService<EmployeeAppointment> {
	constructor(
		typeOrmEmployeeAppointmentRepository: TypeOrmEmployeeAppointmentRepository,
		mikroOrmEmployeeAppointmentRepository: MikroOrmEmployeeAppointmentRepository
	) {
		super(typeOrmEmployeeAppointmentRepository, mikroOrmEmployeeAppointmentRepository);
	}

	/**
	 * Finds an employee appointment by its ID.
	 *
	 * @param id - The unique identifier of the employee appointment.
	 * @param relations - An optional array of related entities to include in the query result. Defaults to an empty array.
	 * @returns A promise that resolves to the employee appointment entity, including any specified relations.
	 */
	async findById(id: ID, relations: string[] = []): Promise<IEmployeeAppointment> {
		return await super.findOneByIdString(id, { relations });
	}

	/**
	 * Saves a new employee appointment to the database.
	 *
	 * @param input - The data required to create a new employee appointment, encapsulated in an `IEmployeeAppointmentCreateInput` object.
	 * @returns A promise that resolves to the saved `EmployeeAppointment` entity.
	 */
	async saveAppointment(input: IEmployeeAppointmentCreateInput): Promise<EmployeeAppointment> {
		return await this.typeOrmRepository.save(input);
	}

	/**
	 * Signs an appointment ID using a JSON Web Token (JWT).
	 *
	 * @param id - The ID of the appointment to be signed.
	 * @returns A signed JWT token containing the appointment ID.
	 */
	signAppointmentId(id: ID): string {
		return sign({ appointmentId: id }, env.JWT_SECRET, {});
	}

	/**
	 * Decodes a signed appointment ID from a JSON Web Token (JWT).
	 *
	 * @param token
	 * @returns
	 */
	decodeSignToken(token: string): JwtPayload | string {
		return decode(token);
	}
}
