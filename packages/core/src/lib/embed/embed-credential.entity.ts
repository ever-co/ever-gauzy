import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JoinColumn, RelationId } from 'typeorm';
import { Exclude } from 'class-transformer';
import { ID, IEmbedCredential, IOrganizationContact } from '@gauzy/contracts';
import { OrganizationContact, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { ExportRedacted } from '../export-import/export-redact.decorator';
import { SkipExport } from '../export-import/skip-export.decorator';
import { MikroOrmEmbedCredentialRepository } from './repository/mikro-orm-embed-credential.repository';

/**
 * A credential a host's backend holds to embed the timer for the members of one organization. Only the secret's
 * SHA-256 is stored; the secret is shown once, at creation.
 */
@SkipExport()
@MultiORMEntity('embed_credential', { mikroOrmRepository: () => MikroOrmEmbedCredentialRepository })
export class EmbedCredential extends TenantOrganizationBaseEntity implements IEmbedCredential {
	@ApiProperty({ type: () => String, maxLength: 100 })
	@MultiORMColumn({ length: 100 })
	name: string;

	@ExportRedacted({ blank: true })
	@Exclude({ toPlainOnly: true })
	@ColumnIndex({ unique: true })
	@MultiORMColumn({ length: 64 })
	keyHash: string;

	@ApiProperty({ type: () => String, maxLength: 20 })
	@MultiORMColumn({ length: 20 })
	prefix: string;

	/**
	 * Deleting the client deletes the credential: a credential limited to a client never outlives it as one of the
	 * whole organization.
	 */
	@MultiORMManyToOne(() => OrganizationContact, {
		nullable: true,
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	organizationContact?: IOrganizationContact;

	@ApiPropertyOptional({ type: () => String, nullable: true })
	@RelationId((it: EmbedCredential) => it.organizationContact)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	organizationContactId?: ID | null;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	lastUsedAt: Date | null;

	@ApiPropertyOptional({ type: () => Date })
	@MultiORMColumn({ nullable: true })
	revokedAt: Date | null;
}
