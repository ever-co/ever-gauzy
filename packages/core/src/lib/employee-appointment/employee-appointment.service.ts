import { BadRequestException, Injectable } from '@nestjs/common';
import { ID, IEmployeeAppointment, IEmployeeAppointmentCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { signPurposeToken, TokenPurposeEnum, verifyPurposeToken } from '../auth/purpose-token';
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
		return await this.save(input);
	}

	/**
	 * Signs an appointment ID using a JSON Web Token (JWT), for the reschedule link.
	 *
	 * The token is purpose-typed and expires, and it is only issued for an appointment the caller
	 * can read. It used to be an untyped, non-expiring JWT_SECRET token over ANY id the caller
	 * supplied, which other token consumers then accepted as their own (GHSA-28wv-vrxj-rp4q).
	 *
	 * @param id - The ID of the appointment to be signed.
	 * @returns A signed JWT token containing the appointment ID.
	 */
	async signAppointmentId(id: ID): Promise<string> {
		// Tenant-scoped lookup: throws when the appointment is not visible to the caller.
		const appointment = await this.findOneByIdString(id);

		return signPurposeToken(
			TokenPurposeEnum.APPOINTMENT,
			{ appointmentId: appointment.id, tenantId: appointment.tenantId },
			{ expiresIn: EmployeeAppointmentService.getRescheduleTokenLifetime(appointment.endDateTime) }
		);
	}

	/**
	 * Verifies a reschedule-link token and returns the appointment ID it names.
	 *
	 * Links issued before the token was typed carry no purpose and no expiry; they are still
	 * accepted, but only when they name an appointment visible to the caller.
	 *
	 * @param token
	 * @returns The appointment ID.
	 */
	async decodeSignToken(token: string): Promise<ID> {
		let appointmentId: string;
		try {
			({ appointmentId } = verifyPurposeToken<{ appointmentId: string }>(token, TokenPurposeEnum.APPOINTMENT, {
				requiredClaims: ['appointmentId'],
				allowLegacyUntyped: true
			}));
		} catch {
			throw new BadRequestException('Invalid appointment token');
		}

		const appointment = await this.findOneByIdString(appointmentId);
		return appointment.id;
	}

	/**
	 * Reschedule links stay valid until a week after the appointment ends, and at least a day.
	 *
	 * @param endDateTime - When the appointment ends.
	 * @returns The token lifetime in seconds.
	 */
	static getRescheduleTokenLifetime(endDateTime?: Date | string | null, now: number = Date.now()): number {
		const DAY = 24 * 60 * 60;
		const end = endDateTime ? new Date(endDateTime).getTime() : Number.NaN;
		const untilWeekAfterEnd = Number.isFinite(end) ? Math.ceil((end - now) / 1000) + 7 * DAY : 0;
		return Math.max(DAY, untilWeekAfterEnd);
	}
}
