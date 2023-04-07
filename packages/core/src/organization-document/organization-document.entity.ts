import { Column, Entity, Index, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { IImageAsset as IDocumentAsset, IOrganizationDocument } from '@gauzy/contracts';
import { ImageAsset, TenantOrganizationBaseEntity } from '../core/entities/internal';

@Entity('organization_document')
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
	@Column({ nullable: true })
	documentId?: IDocumentAsset['id'];
}
