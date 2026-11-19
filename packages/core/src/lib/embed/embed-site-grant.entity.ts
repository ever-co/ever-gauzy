import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { ID, IEmployee, IUser } from '@gauzy/contracts';
import { Employee, TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ExportRedacted } from '../export-import/export-redact.decorator';
import { SkipExport } from '../export-import/skip-export.decorator';
import { MikroOrmEmbedSiteGrantRepository } from './repository/mikro-orm-embed-site-grant.repository';

/**
 * One renewal token of a site a person allowed to start and stop their timer (`POST /embed/authorize`). A renewal
 * spends it (`usedAt`) and adds the next one; the tokens of one sign-in share a `familyId`, which the person and the
 * organization's administrators see as the site grant. Only the token's SHA-256 is stored; the token is shown once.
 *
 * Never exported: an import must not bring a working token onto another server. The rows go with the person's account
 * and with their employee (both cascade).
 */
@SkipExport()
@MultiORMEntity('embed_site_grant', { mikroOrmRepository: () => MikroOrmEmbedSiteGrantRepository })
export class EmbedSiteGrant extends TenantOrganizationBaseEntity {
	/** The person who allowed the site. */
	@MultiORMManyToOne(() => User, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmbedSiteGrant) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId: ID;

	/** The person's employee in the organization: the one member the site's timer tokens act for. */
	@MultiORMManyToOne(() => Employee, {
		nullable: false,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@RelationId((it: EmbedSiteGrant) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	employeeId: ID;

	/** The site, normalized as the browser's `Origin` header (`https://app.example.com`). */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@MultiORMColumn({ length: 255 })
	origin: string;

	/** The sign-in this token belongs to: the same on every token its renewals give. */
	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@MultiORMColumn({ type: 'uuid' })
	familyId: ID;

	/** SHA-256 (hex) of the renewal token. */
	@ExportRedacted({ blank: true })
	@Exclude({ toPlainOnly: true })
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ length: 64 })
	keyHash: string;

	/** When the token stops working: 30 days after it was issued, so each renewal gives the sign-in 30 more days. */
	@ApiProperty({ type: () => Date })
	@MultiORMColumn()
	expiresAt: Date;

	/** When a renewal spent the token. A spent token used again revokes its whole sign-in. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	usedAt: Date | null;

	/** When its sign-in was revoked: by the site's sign-out, the person, an administrator, or a reused token. */
	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	revokedAt: Date | null;
}
