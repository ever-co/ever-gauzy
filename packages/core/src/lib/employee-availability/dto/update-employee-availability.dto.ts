import { PartialType } from '@nestjs/mapped-types';
import { IEmployeeAvailabilityUpdateInput } from '@gauzy/contracts';
import { CreateEmployeeAvailabilityDTO } from './create-employee-availability.dto';

export class UpdateEmployeeAvailabilityDTO
	extends PartialType(CreateEmployeeAvailabilityDTO)
	implements IEmployeeAvailabilityUpdateInput {}
