/**
 * StockAlert request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * StockAlert request DTO validation.
 */
export class StockAlertDTO extends TenantOrganizationBaseDTO {
	/**
	 * Variant the rule watches.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	variantId?: string;

	/**
	 * Location the rule watches; null watches the sum across locations.
	 */
	@ApiPropertyOptional({ type: () => String })
		@IsOptional()
		@IsUUID()
	warehouseId?: string;

	/**
	 * Availability at or below which the rule fires.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsNumber()
	threshold?: number;

	/**
	 * Additional recipients.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
		@IsOptional()
		@IsArray()
	notifyEmails?: string[];

	/**
	 * Roles whose members are notified.
	 */
	@ApiPropertyOptional({ type: () => Array, isArray: true })
		@IsOptional()
		@IsArray()
	notifyRoles?: string[];

	/**
	 * Minimum gap between two fires of the same rule.
	 */
	@ApiPropertyOptional({ type: () => Number })
		@IsOptional()
		@IsInt()
	cooldownMinutes?: number;
}
