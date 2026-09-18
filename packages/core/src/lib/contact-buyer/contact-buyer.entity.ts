import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
	ContactBuyerRole,
	ID,
	IContactBuyer,
	IOrganizationContact,
	IUser,
	JsonData
} from '@gauzy/contracts';
import { OrganizationContact, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, JsonColumn, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ColumnNumericTransformerPipe } from '../shared/pipes';
import { MikroOrmContactBuyerRepository } from './repository/mikro-orm-contact-buyer.repository';

/**
 * One membership of a person in a company account — the pivot between a company and one of its buyers.
 *
 * **A pivot rather than a second kind of party.** A company account is an `organization_contact` that
 * has buyer rows, so a person remains exactly one contact row and their company relationship is a
 * relation instead of a duplicate record. Membership state uses the inherited `isActive` / `deletedAt`
 * columns: there is no second active flag to keep in step with the first.
 *
 * **Why the authority is here and not in `role` / `role_permission`.** A buyer is not a member of staff:
 * they have no `user` row in the common case, no employee record and no business in the back-office
 * permission model. A tenant `role` is tenant-wide, so using one for a buyer would grant one company's
 * purchasing clerk authority that every other actor in the tenant can see and reuse, and "one row per
 * company and buyer" could not be expressed. The membership's own `role` and its limits are the
 * authority, and a staff member who also buys keeps their staff role as well — the two are additive.
 *
 * **The limits narrow and never widen.** A buyer's per-order ceiling and the company's remaining credit
 * are both ceilings, so the effective one is the lower of the two: a limit on the membership can only
 * take authority away from the account.
 *
 * **A buyer belongs to at most one live company account, and never to itself.** The pair is unique in the
 * database; the two rules that a pair cannot be its own company and that a buyer holds at most one live
 * membership are statements about the row's *other* rows, so they are decided by the service under a
 * lock on the company account — which is what stops two concurrent invitations from both passing a
 * read-then-write check.
 */
@ColumnIndex('UQ_contact_buyer', ['companyCustomerId', 'buyerCustomerId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_contact_buyer_buyer', ['buyerCustomerId'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_contact_buyer_company', ['companyCustomerId', 'isActive'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('contact_buyer', { mikroOrmRepository: () => MikroOrmContactBuyerRepository })
export class ContactBuyer extends TenantOrganizationBaseEntity implements IContactBuyer {
	/**
	 * The company account. It is a contact whose `partyKind` is `COMPANY`, which the service checks.
	 *
	 * Cascades: the membership has no meaning without the account, and a company account removed by a
	 * retention job must not leave memberships naming nothing.
	 */
	@ApiProperty({ type: () => OrganizationContact })
	@IsUUID()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	companyCustomer: IOrganizationContact;

	/** Id of the company account. The first column of the one-membership-per-pair rule. */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ContactBuyer) => it.companyCustomer)
	@MultiORMColumn({ relationId: true })
	companyCustomerId: ID;

	/**
	 * The individual buyer: a different contact from the company account, always.
	 *
	 * Cascades for the same reason as the account side — the membership is the relationship, and a
	 * relationship to a party that no longer exists is a row nothing can resolve.
	 */
	@ApiProperty({ type: () => OrganizationContact })
	@IsUUID()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	buyerCustomer: IOrganizationContact;

	/** Id of the buyer. */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ContactBuyer) => it.buyerCustomer)
	@MultiORMColumn({ relationId: true })
	buyerCustomerId: ID;

	/**
	 * What the buyer may do inside the account.
	 *
	 * The default is `PURCHASER`, because a buyer added to a company account is normally there to buy.
	 * The role is the membership discriminator and never the capability: an approver's approval is the
	 * platform permission the approval flow evaluates.
	 */
	@ApiProperty({ type: () => String, enum: ContactBuyerRole, default: ContactBuyerRole.PURCHASER })
	@IsEnum(ContactBuyerRole)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: ContactBuyerRole,
		default: ContactBuyerRole.PURCHASER
	})
	role: ContactBuyerRole;

	/**
	 * The per-order ceiling for this buyer; null means the company's credit facility governs alone.
	 *
	 * `numeric(20,6)` with the platform's transformer, because the driver hands a `numeric` back as a
	 * string and a ceiling compared as a string is a defect that only shows on some values.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	spendingLimit?: number;

	/** The ceiling over one rolling period, evaluated as `periodSpent + total <= periodSpendingLimit` when it is set. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	periodSpendingLimit?: number;

	/** Orders at or above this amount require an approval; null means the group, channel or organization threshold applies. */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({
		type: 'numeric',
		precision: 20,
		scale: 6,
		nullable: true,
		transformer: new ColumnNumericTransformerPipe()
	})
	approvalThreshold?: number;

	/**
	 * The day of the month the rolling period restarts.
	 *
	 * Bounded to 1–28 and not 1–31: a period that began on the 31st would have no anniversary in four
	 * months of the year, and a limit that silently skips its own reset is worse than one that resets a
	 * few days early.
	 */
	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@Min(1)
	@Max(28)
	@MultiORMColumn({ type: 'int', nullable: true })
	periodStartDay?: number;

	/** When the buyer was attached to the account. */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	assignedAt?: Date;

	/**
	 * The staff user who invited the buyer, when a member of staff did.
	 *
	 * Releases rather than cascades: who invited whom is history, and the membership outlives the
	 * inviter's account.
	 */
	@ApiPropertyOptional({ type: () => User })
	@IsOptional()
	@MultiORMManyToOne(() => User, {
		nullable: true,
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invitedByUser?: IUser;

	/** Id of the inviting staff user. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ContactBuyer) => it.invitedByUser)
	@MultiORMColumn({ nullable: true, relationId: true })
	invitedByUserId?: ID;

	/** Tenant-defined extras. */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@JsonColumn<JsonData>({ nullable: true })
	metadata?: JsonData;
}
