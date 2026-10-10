import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { IsDecimalAmount } from '../../payment.validators';

/**
 * One line a refund paid back.
 *
 * The shape is the request body of the refund-line routes, the body of one entry of the `lines`
 * member of a refund request, and the response body of every read. What it deliberately does not
 * carry is the currency of the refund it belongs to: a line is given back in the refund's currency
 * and a request that names a different one is refused rather than converted.
 *
 * The refund is optional here because a line nested inside a refund request already knows which
 * refund it is being written for; the create route, which stands alone, states it.
 */
export class RefundLineDTO extends TenantOrganizationBaseDTO {
	/**
	 * The refund this line is part of.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly refundId?: string;

	/**
	 * The order line the money is attributed to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly orderLineId: string;

	/**
	 * How much of the line came back, as a positive exact decimal.
	 *
	 * Declared as the decimal string the `numeric(20,6)` column stores rather than as a member that
	 * also admits a `number`: the validator still accepts an exactly representable JSON number, and
	 * the declared type is the one the entity carries, which is what lets the routes that take this
	 * shape override the CRUD surface of `RefundLine` without widening what the column holds.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly quantity: DecimalString;

	/**
	 * What was given back for that line, as a positive exact decimal. The refund's amount is the
	 * ceiling of the sum of these figures.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly amount: DecimalString;

	/**
	 * Currency of the amount; the refund's own currency when the line is written with its refund.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly currency?: string;

	/**
	 * Tenant extras carried on the line.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
