import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IImageAsset as IDocumentAsset, IOrganizationDocument } from '@gauzy/contracts';
import { ImageAsset, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from './../core/decorators/entity';
import { MikroOrmOrganizationDocumentRepository } from './repository/mikro-orm-organization-document.repository';

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
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

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
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	documentId?: IDocumentAsset['id'];
}
