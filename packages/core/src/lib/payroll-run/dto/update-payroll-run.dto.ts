import { PartialType } from '@nestjs/swagger';
import { IPayrollRunUpdateInput } from '@gauzy/contracts';
import { CreatePayrollRunDTO } from './create-payroll-run.dto';

/**
 * Update Payroll Run request DTO.
 *
 * Derived from the create DTO, so `status`, `totalGross`, `totalDeductions` and `totalNet` cannot
 * be set here either. Combined with `whitelist: true` on the endpoint, a body carrying them is
 * stripped rather than silently applied.
 */
export class UpdatePayrollRunDTO extends PartialType(CreatePayrollRunDTO) implements IPayrollRunUpdateInput {}
