import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { PaymentCollectionStatus } from '../../payment.types';
import { IsDecimalAmount } from '../../payment.validators';

/**
 * The money side of one order or cart: how much must be collected, authorised, captured and returned.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class PaymentCollectionDTO extends TenantOrganizationBaseDTO {
	/**
	 * The order being collected for; null while the collection belongs to a cart.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: string;

	/**
	 * The cart being collected for.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly cartId?: string;

	/**
	 * The amount to be collected.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly amount: DecimalString | number;

	/**
	 * Currency of the collection.
	 */
	@ApiProperty({ type: () => String, minLength: 3, maxLength: 3 })
	@IsString()
	@Length(3, 3)
	readonly currency: string;

	/**
	 * Derived from the amounts and the sessions; never set by a caller.
	 */
	@ApiPropertyOptional({ type: () => String, enum: PaymentCollectionStatus })
	@IsOptional()
	@IsEnum(PaymentCollectionStatus)
	readonly status: PaymentCollectionStatus = PaymentCollectionStatus.NOT_PAID;

	/**
	 * Sum of successful authorisations.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly authorizedAmount: DecimalString | number = 0;

	/**
	 * Sum of captures.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly capturedAmount: DecimalString | number = 0;

	/**
	 * Sum of succeeded refunds.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly refundedAmount: DecimalString | number = 0;

	/**
	 * Sum of voided authorisations.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly canceledAmount: DecimalString | number = 0;

	/**
	 * Currency the collection is expected to settle in, when it differs from the presentment currency.
	 */
	@ApiPropertyOptional({ type: () => String, minLength: 3, maxLength: 3 })
	@IsOptional()
	@IsString()
	@Length(3, 3)
	readonly settlementCurrency?: string;

	/**
	 * The expected settled amount in the settlement currency.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly settlementAmount?: DecimalString | number;

	/**
	 * Rate used to derive the expected settlement.
	 */
	@ApiPropertyOptional({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsOptional()
	@IsDecimalAmount()
	readonly fxRate?: DecimalString | number;

	/**
	 * The exchange-rate row the rate was read from; a snapshot reference with no foreign key.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly fxRateId?: string;

	/**
	 * When the expected rate was taken.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly fxCapturedAt?: Date;

	/**
	 * When the collection reached a settled state.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly completedAt?: Date;

	/**
	 * Capture mode, split plan and the purpose marker of a zero-amount verification collection.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: Record<string, unknown>;
}
