import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContactGroupSource, ID, IContactGroup, IContactGroupMember, IOrganizationContact } from '@gauzy/contracts';
import { OrganizationContact, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ContactGroup } from '../contact-group/contact-group.entity';
import { MikroOrmContactGroupMemberRepository } from './repository/mikro-orm-contact-group-member.repository';

/**
 * One explicit group membership — the pivot between a party and a group.
 *
 * **A pivot and not a column on the party.** A contact belongs to any number of groups, and the
 * membership carries facts of its own: when it was granted, when it lapses, and who wrote it. The row
 * has no meaning without either peer, which is why both references cascade.
 *
 * **The provenance column is load-bearing.** It decides what may remove the row: a hand-written
 * membership is never removed by an evaluation or by an import, and a rule-written one may be replaced
 * wholesale by the next evaluation of its segment. Without it, a nightly re-evaluation would be entitled
 * to delete a membership an operator created by hand — so the column is not a note about the row's
 * history, it is the row's ownership.
 *
 * **An expired row is absent, not merely stale.** Every reader — the segment evaluator, the pricing
 * context, the membership list — treats `expiresAt <= now()` as "not a member", before the cleanup job
 * removes the row, so a lapsed trial never grants anything in the window between lapsing and being
 * swept. That reading is why the group's own index carries the expiry window as its second column.
 */
@ColumnIndex('UQ_contact_group_member', ['customerId', 'groupId'], {
	unique: true,
	where: '"deletedAt" IS NULL'
})
@ColumnIndex('IDX_contact_group_member_group', ['groupId', 'expiresAt'], { where: '"deletedAt" IS NULL' })
@ColumnIndex('IDX_contact_group_member_customer', ['customerId'], { where: '"deletedAt" IS NULL' })
@MultiORMEntity('contact_group_member', { mikroOrmRepository: () => MikroOrmContactGroupMemberRepository })
export class ContactGroupMember extends TenantOrganizationBaseEntity implements IContactGroupMember {
	/**
	 * The party that is a member.
	 *
	 * Cascades rather than releases, because the pivot has no independent meaning: a membership that
	 * named a party which no longer exists would be a row nothing can resolve and nothing can clean up
	 * except a scan of the whole table.
	 */
	@ApiProperty({ type: () => OrganizationContact })
	@IsUUID()
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	customer: IOrganizationContact;

	/** Id of the party. The first column of the one-row-per-pair rule. */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ContactGroupMember) => it.customer)
	@MultiORMColumn({ relationId: true })
	customerId: ID;

	/**
	 * The group the party belongs to.
	 *
	 * The relation object, because both ends of the pivot live in the kernel: the group is a core table
	 * created by the same set as this one, so importing its class costs nothing and gains the join that
	 * every membership read wants.
	 */
	@ApiProperty({ type: () => ContactGroup })
	@IsUUID()
	@MultiORMManyToOne(() => ContactGroup, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	group: IContactGroup;

	/** Id of the group. The second column of the one-row-per-pair rule. */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: ContactGroupMember) => it.group)
	@MultiORMColumn({ relationId: true })
	groupId: ID;

	/**
	 * When the membership was granted.
	 *
	 * The column's default is `now()`, and the service states it explicitly on every write so a row
	 * written through a path that ignores defaults still carries the instant an operator would read.
	 */
	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	assignedAt: Date;

	/**
	 * When the membership lapses, for a temporary one.
	 *
	 * Null means it does not lapse. A row whose window has passed is treated as absent by every reader
	 * and removed by the nightly sweep; it is kept rather than deleted at the moment of expiry so that
	 * "this party was a member until Tuesday" remains answerable.
	 */
	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ nullable: true })
	expiresAt?: Date;

	/** Who wrote the row, which is also what may remove it. */
	@ApiProperty({ type: () => String, enum: ContactGroupSource, default: ContactGroupSource.MANUAL })
	@IsEnum(ContactGroupSource)
	@MultiORMColumn({
		type: 'simple-enum',
		enum: ContactGroupSource,
		default: ContactGroupSource.MANUAL
	})
	source: ContactGroupSource;
}
