import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDate, IsInt, IsOptional, IsEnum, IsUUID, Min, Max } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { AvailabilityStatusEnum, ID, IEmployee, IEmployeeAvailability } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { AvailabilityStatusTransformer } from './pipes/employee-availability-status.pipe';
import { IsBeforeDate } from '../shared/validators';

@MultiORMEntity('employee_availability')
export class EmployeeAvailability extends TenantOrganizationBaseEntity implements IEmployeeAvailability {
	/**
	 * Represents the start date of an employee's availability period.
	 * This marks when the availability status takes effect.
	 */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@IsNotEmpty()
	@IsBeforeDate(EmployeeAvailability, (it) => it.endDate, {
		message: 'Start date must be before to the end date'
	})
	@MultiORMColumn()
	startDate: Date;

	/**
	 * Represents the end date of an employee's availability period.
	 * This marks when the availability status expires.
	 */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@IsNotEmpty()
	@MultiORMColumn()
	endDate: Date;

	/**
	 * The day of the week corresponding to the availability.
	 * Values range from `0` (Sunday) to `6` (Saturday).
	 */
	@ApiProperty({ type: () => Number, description: 'Day of the week (0 = Sunday, 6 = Saturday)' })
	@IsInt()
	@IsNotEmpty()
	@Min(0, { message: 'Day of week must be between 0 and 6' })
	@Max(6, { message: 'Day of week must be between 0 and 6' })
	@MultiORMColumn()
	dayOfWeek: number;

	/**
	 * The availability status of the employee.
	 * Uses `AvailabilityStatusEnum` to define the available states.
	 */
	@ApiProperty({ enum: AvailabilityStatusEnum })
	@IsEnum(AvailabilityStatusEnum)
	@MultiORMColumn({
		type: 'int',
		transformer: new AvailabilityStatusTransformer()
	})
	availabilityStatus: AvailabilityStatusEnum;

	/**
	 * Optional notes providing additional details about the availability.
	 * Example: "Available until 2 PM" or "Remote work only."
	 */
	@ApiPropertyOptional({
		type: () => String,
		description: 'Optional notes (e.g., "Available until 2 PM")'
	})
	@IsString()
	@IsOptional()
	@MultiORMColumn({ type: 'text', nullable: true })
	availabilityNotes?: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Reference to the Employee associated with this availability record.
	 * Establishes a many-to-one relationship, meaning multiple availability records
	 * can be linked to a single employee.
	 */
	@MultiORMManyToOne(() => Employee, (it) => it.availabilities, {
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: IEmployee;

	/**
	 * The UUID representing the linked `Employee` record.
	 * This serves as the foreign key that connects the availability record to a specific employee.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: EmployeeAvailability) => it.employee)
	@MultiORMColumn({ relationId: true })
	employeeId: ID;
}
