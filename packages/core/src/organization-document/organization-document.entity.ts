import { Index, JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IImageAsset as IDocumentAsset, IOrganizationDocument } from '@gauzy/contracts';
import { ImageAsset, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationDocumentRepository } from './repository/mikro-orm-organization-document.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_document', { mikroOrmRepository: () => MikroOrmOrganizationDocumentRepository })
export class OrganizationDocument extends TenantOrganizationBaseEntity implements IOrganizationDocument {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	name: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ nullable: true })
	documentUrl: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Document Asset
	 */
	@MultiORMManyToOne(() => ImageAsset, {
		/** Database cascade action on delete. */
		onDelete: 'SET NULL',

		/** Eager relations are always loaded automatically when relation's owner entity is loaded using find* methods. */
		eager: true
	})
	@JoinColumn()
	document?: IDocumentAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationDocument) => it.document)
	@Index()
	@MultiORMColumn({ nullable: true })
	documentId?: IDocumentAsset['id'];
}
