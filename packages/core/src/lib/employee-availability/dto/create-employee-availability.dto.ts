import { IntersectionType, PickType } from '@nestjs/swagger';
import { IEmployeeAvailabilityCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { EmployeeAvailability } from '../employee-availability.entity';

export class CreateEmployeeAvailabilityDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		PickType(EmployeeAvailability, [
			'dayOfWeek',
			'startDate',
			'endDate',
			'availabilityNotes',
			'availabilityStatus',
			'employeeId'
		])
	)
	implements IEmployeeAvailabilityCreateInput {}
