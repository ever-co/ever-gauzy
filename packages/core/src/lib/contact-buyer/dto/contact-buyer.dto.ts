import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	IsDate,
	IsEnum,
	IsInt,
	IsNumber,
	IsObject,
	IsOptional,
	IsUUID,
	Max,
	Min,
	ValidateNested
} from 'class-validator';
import { ContactBuyerRole, ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * What a caller states when it attaches a buyer to a company account.
 *
 * **The company is named by the caller rather than taken from the buyer.** Membership is the account's
 * fact, and a body that named no account would have to guess one from the buyer's other rows — which is
 * exactly the read-then-write the one-live-account rule has to prevent, so the service refuses a body
 * that names only one side.
 *
 * **Neither side of the pivot is mutable afterwards.** A membership that could be re-pointed at another
 * buyer or another account would be a way to move purchasing authority without a trace, so this
 * resource has a create and a removal and no update: the supported path is to remove the membership and
 * attach a new one. The ceilings are validated here as non-negative amounts as well as in the service,
 * and the period start day as a day between 1 and 28, so that every month has it.
 */
export class CreateContactBuyerDTO extends TenantOrganizationBaseDTO {
	/**
	 * The company account the buyer joins. It is a contact whose kind is `COMPANY`.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly companyCustomerId: ID;

	/**
	 * The buyer joining it. A different contact from the account, always.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly buyerCustomerId: ID;

	/**
	 * What the buyer may do inside the account. Defaults to `PURCHASER`.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactBuyerRole })
	@IsOptional()
	@IsEnum(ContactBuyerRole)
	readonly role?: ContactBuyerRole;

	/**
	 * The per-order ceiling for this buyer. Null means the account's credit facility governs alone.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	readonly spendingLimit?: number;

	/**
	 * The ceiling over one rolling period.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	readonly periodSpendingLimit?: number;

	/**
	 * Orders at or above this amount require an approval.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0)
	readonly approvalThreshold?: number;

	/**
	 * The day of the month the rolling period restarts. Bounded to 1–28 so that every month has it.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 28 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(28)
	readonly periodStartDay?: number;

	/**
	 * When the buyer was attached. Defaults to now.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@Type(() => Date)
	@IsDate()
	readonly assignedAt?: Date;

	/**
	 * The staff user making the invitation, when a member of staff did.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly invitedByUserId?: ID;

	/**
	 * Tenant-defined extras.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The narrowing members of the membership list, in the flat spelling.
 *
 * The endpoint table names the two sides of the pivot `contactId` and `organizationContactId` — the
 * vocabulary of the contact resource — while the delivered list method names the columns it narrows on
 * `buyerCustomerId` and `companyCustomerId`. Both spellings are accepted (see the query DTO), because a
 * client written against either document reaches the same rows.
 */
export class ContactBuyerFilterDTO {
	/**
	 * Restrict to the memberships of one buyer, under the table's spelling.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly contactId?: ID;

	/**
	 * Restrict to the buyers of one company account, under the table's spelling.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationContactId?: ID;

	/**
	 * Restrict to the memberships of one buyer, under the column's own name.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly buyerCustomerId?: ID;

	/**
	 * Restrict to the buyers of one company account, under the column's own name.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly companyCustomerId?: ID;

	/**
	 * Restrict to one role.
	 */
	@ApiPropertyOptional({ type: () => String, enum: ContactBuyerRole })
	@IsOptional()
	@IsEnum(ContactBuyerRole)
	readonly role?: ContactBuyerRole;
}

/**
 * The query of `GET /contact-buyers`.
 *
 * Both spellings of every member are accepted: the ones the endpoint table uses (`contactId`,
 * `organizationContactId`) and the ones the delivered list method narrows on, in both the flat and the
 * bracketed spelling. The table's spelling wins when both are stated, because that is the document a
 * client is written against.
 */
export class ContactBuyerQueryDTO extends ContactBuyerFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => ContactBuyerFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => ContactBuyerFilterDTO)
	readonly filter?: ContactBuyerFilterDTO;

	/**
	 * How many memberships to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many memberships to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}
