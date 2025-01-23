import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeAvailabilityDTO } from './create-employee-availability.dto';
import { IEmployeeAvailabilityUpdateInput } from '@gauzy/contracts';

export class UpdateEmployeeAvailabilityDTO
	extends PartialType(CreateEmployeeAvailabilityDTO)
	implements IEmployeeAvailabilityUpdateInput {}
