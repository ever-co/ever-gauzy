import { IntersectionType, OmitType } from '@nestjs/swagger';
import { IsObject, IsOptional, IsUUID } from 'class-validator';
import { ID, IDashboardCreateInput, IEmployee } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { IsEmployeeBelongsToOrganization } from '../../shared/validators';
import { Dashboard } from '../dashboard.entity';

/**
 * Create Dashboard validation request DTO
 */
export class CreateDashboardDTO
	extends IntersectionType(
		TenantOrganizationBaseDTO,
		OmitType(Dashboard, ['isDefault', 'createdByUser', 'createdByUserId'] as const)
	)
	implements IDashboardCreateInput
{
	/*
	 * The employee must belong to the dashboard's organization. This database-backed check lives on
	 * the DTO (like `EmployeeFeatureDTO`), not on the `Dashboard` entity: the validator's constraint
	 * injects the employee repositories, which load every entity, so an entity carrying it closes a
	 * CommonJS cycle — anything that loaded `shared/validators` first saw the barrel half-initialised
	 * ("IsEmployeeBelongsToOrganization is not a function"). `UpdateDashboardDTO` inherits it through
	 * `PartialType`.
	 *
	 * The entity's own rules are repeated here on purpose: class-validator drops an inherited rule when
	 * the subclass declares one of the same kind on the same property, and `@IsObject()` / `@IsUUID()`
	 * are the same kind (custom validation) as the membership check.
	 */
	@IsOptional()
	@IsObject()
	@IsEmployeeBelongsToOrganization()
	employee?: IEmployee;

	@IsOptional()
	@IsUUID()
	@IsEmployeeBelongsToOrganization()
	employeeId?: ID;
}
