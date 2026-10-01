import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { RelationId } from 'typeorm';
import { ID, IUser } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantBaseEntity, User } from '@gauzy/core';

/** How a link between an Ever ID and a Gauzy user was made. */
export const ZITADEL_LINK_METHODS = ['explicit', 'confirmed', 'provisioned', 'signup'] as const;
export type ZitadelLinkMethod = (typeof ZITADEL_LINK_METHODS)[number];

/**
 * One link between an Ever ID (`issuer` + `subject`) and one Gauzy user row.
 *
 * A person who works in several tenants has one Gauzy user per tenant, so one identity can own
 * several rows here. A row is written only after the person proved control of both sides
 * (`linkMethod`); an e-mail match alone never creates one.
 */
// Also serves every lookup by (issuer, subject), through its leading columns.
@ColumnIndex('IDX_zitadel_account_issuer_subject_user', ['issuer', 'subject', 'userId'], { unique: true })
@MultiORMEntity('zitadel_account')
export class ZitadelAccount extends TenantBaseEntity {
	/** Exact issuer identifier of the identity. */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	issuer: string;

	/** The identity's `sub` at that issuer. */
	@ApiProperty({ type: () => String })
	@IsString()
	@MultiORMColumn()
	subject: string;

	/** The Gauzy user this identity signs in as. */
	@MultiORMManyToOne(() => User, {
		/** Database cascade action on delete: the link goes with the user. */
		onDelete: 'CASCADE'
	})
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: ZitadelAccount) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId: ID;

	/** Informational person id from the identity provider, never used as a key. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	everPersonId?: string;

	/** The verified e-mail the identity carried when the link was made (shown in Settings). */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	emailAtLink?: string;

	@ApiProperty({ type: () => String, enum: ZITADEL_LINK_METHODS })
	@IsIn([...ZITADEL_LINK_METHODS])
	@MultiORMColumn()
	linkMethod: ZitadelLinkMethod;

	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	linkedAt: Date;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	lastLoginAt?: Date;
}
