import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';
import { GiftCardTransactionType } from '../../promotion.types';
import { IsDecimalAmount } from '../../promotion.validators';

/**
 * One movement on a gift card. Append-only: a correction is a new ADJUST row.
 *
 * The shape is the request body of the create and update routes and the response body of every read,
 * so it carries the whole writable surface of the aggregate and nothing the service derives.
 */
export class GiftCardTransactionDTO extends TenantOrganizationBaseDTO {
	/**
	 * The card this movement belongs to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly giftCardId: string;

	/**
	 * The order the movement settled, when it settled one.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly orderId?: string;

	/**
	 * Signed amount: negative debits the card, positive credits it.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	// `DecimalString`, not `DecimalString | number`: the column is an exact decimal, the validator
	// already refuses a value that is not one, and the wider type said a caller could send a float —
	// which the money rules forbid and which the entity's own type does not accept. It also made this
	// DTO wider than the entity it describes, so the controller that names it could not be a narrowing
	// of the CRUD base and did not type-check.
	readonly amount: DecimalString;

	/**
	 * The card balance after this movement.
	 */
	@ApiProperty({ type: () => String, description: 'Exact decimal: send the decimal digits, never a rounded float.' })
	@IsDecimalAmount()
	readonly balanceAfter: DecimalString;

	/**
	 * Issue, redeem, refund, adjust or expire.
	 */
	@ApiProperty({ type: () => String, enum: GiftCardTransactionType })
	@IsEnum(GiftCardTransactionType)
	readonly type: GiftCardTransactionType;

	/**
	 * Why the movement was written.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	readonly note?: string;

	/**
	 * When the movement happened.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	readonly occurredAt?: Date;
}
