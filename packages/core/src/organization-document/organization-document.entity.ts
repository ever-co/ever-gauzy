import { Column, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IImageAsset as IDocumentAsset, IOrganizationDocument } from '@gauzy/contracts';
import { ImageAsset, TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationDocumentRepository } from './repository/mikro-orm-organization-document.repository';

@MultiORMEntity('organization_document', { mikroOrmRepository: () => MikroOrmOrganizationDocumentRepository })
export class OrganizationDocument extends TenantOrganizationBaseEntity implements IOrganizationDocument {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column()
	name: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column({ nullable: true })
	documentUrl: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * Document Asset
	 */
	@ManyToOne(() => ImageAsset, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	document?: IDocumentAsset;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: OrganizationDocument) => it.document)
	@Index()
	@Column({ nullable: true })
	documentId?: IDocumentAsset['id'];
}
