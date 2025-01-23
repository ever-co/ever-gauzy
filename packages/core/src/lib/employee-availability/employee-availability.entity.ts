import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDate, IsInt, IsOptional, IsEnum } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { AvailabilityStatusEnum, ID, IEmployeeAvailability } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { AvailabilityStatusTransformer } from '../shared/pipes/employee-availability-status.pipe';

@MultiORMEntity('employee_availability')
export class EmployeeAvailability extends TenantOrganizationBaseEntity implements IEmployeeAvailability {
	@ApiProperty({ type: () => Date })
	@IsDate()
	@IsNotEmpty()
	@MultiORMColumn()
	startDate: Date;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@IsNotEmpty()
	@MultiORMColumn()
	endDate: Date;

	@ApiProperty({ type: () => Number, description: 'Day of the week (0 = Sunday, 6 = Saturday)' })
	@IsInt()
	@IsNotEmpty()
	@MultiORMColumn({ type: 'int' })
	dayOfWeek: number;

	@ApiProperty({ enum: AvailabilityStatusEnum })
	@IsEnum(AvailabilityStatusEnum)
	@MultiORMColumn({
		type: 'int',
		transformer: new AvailabilityStatusTransformer()
	})
	availabilityStatus: AvailabilityStatusEnum;

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
	 * Employee
	 */
	@MultiORMManyToOne(() => Employee, {
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee: Employee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmployeeAvailability) => it.employee)
	@MultiORMColumn()
	employeeId: ID;
}
