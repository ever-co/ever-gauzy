import { ApiProperty } from '@nestjs/swagger';
import { Index } from 'typeorm';
import { IEmbedAllowedOrigin } from '@gauzy/contracts';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from '../core/decorators/entity';
import { SkipExport } from '../export-import/skip-export.decorator';
import { MikroOrmEmbedAllowedOriginRepository } from './repository/mikro-orm-embed-allowed-origin.repository';

/**
 * A site allowed to embed the timer of one organization. An embed token is exchanged for one of these origins and only
 * works from it; the API answers it for the timer routes (CORS). Who added it and when are the base entity's
 * `createdByUserId` and `createdAt`.
 */
@SkipExport()
@Index(['organizationId', 'origin'], { unique: true })
@MultiORMEntity('embed_allowed_origin', { mikroOrmRepository: () => MikroOrmEmbedAllowedOriginRepository })
export class EmbedAllowedOrigin extends TenantOrganizationBaseEntity implements IEmbedAllowedOrigin {
	/** Scheme, host and port, normalized as the browser's `Origin` header (`https://app.example.com`). */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@MultiORMColumn({ length: 255 })
	origin: string;
}
