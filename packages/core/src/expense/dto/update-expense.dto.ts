import { IExpenseUpdateInput } from '@gauzy/contracts';
import { IntersectionType } from '@nestjs/mapped-types';
import { RelationalCurrencyDTO } from './../../currency/dto';
import { OrganizationVendorFeatureDTO } from '../../organization-vendor/dto';
import { RelationalTagDTO } from './../../tags/dto';
import { ExpenseDTO } from './expense.dto';

/**
 * Update Expense DTO request validation
 */
export class UpdateExpenseDTO
	extends IntersectionType(
		ExpenseDTO,
		OrganizationVendorFeatureDTO,
		IntersectionType(RelationalTagDTO, RelationalCurrencyDTO)
	)
	implements IExpenseUpdateInput {}
