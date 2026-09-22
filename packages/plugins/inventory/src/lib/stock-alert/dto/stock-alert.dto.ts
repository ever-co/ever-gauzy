/**
 * StockAlert request DTO validation.
 *
 * Every column the aggregate accepts from a caller is declared here once, so the create and
 * update shapes cannot drift apart from the read shape.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
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

/**
 * The read shape: the filters a caller may narrow by, plus the page and the soft-delete visibility.
 *
 * **The two halves live on different chains in the platform's DTOs, and that is why this class exists.**
 * `BaseQueryDTO` — the one that carries `take`/`skip`/`withDeleted` — is not in the chain
 * `TenantOrganizationBaseDTO` belongs to, so a resource whose DTO extends the latter accepts no page and no
 * `withDeleted` at all: the validation pipe drops both before the controller sees them, and `GET /stock-alerts`
 * answers its first page of live rules for ever. Declaring them here is the smallest change that makes the
 * route able to ask the same question its GraphQL connection can.
 *
 * `skip` is the **page number**, which is what every REST list route on this platform means by it — the
 * connection's `page: { after }` is the row offset, and the two are deliberately different questions.
 */
export class StockAlertQueryDTO extends StockAlertDTO {
	@ApiPropertyOptional({ type: () => Number, description: 'Rows per page. Defaults to the service’s own.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	take?: number;

	@ApiPropertyOptional({ type: () => Number, description: 'Page number, one-based.' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	skip?: number;

	@ApiPropertyOptional({ type: () => Boolean, description: 'Whether retired rules are included.' })
	@IsOptional()
	@Transform(({ value }) => value === true || value === 'true')
	@IsBoolean()
	withDeleted?: boolean;
}
