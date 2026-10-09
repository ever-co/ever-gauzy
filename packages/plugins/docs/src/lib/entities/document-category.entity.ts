import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IDocument, IDocumentCategory } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmDocumentCategoryRepository } from '../repositories/mikro-orm-document-category.repository';
import { Document } from './document.entity';

@MultiORMEntity('document_category', { mikroOrmRepository: () => MikroOrmDocumentCategoryRepository })
@ColumnIndex('IDX_document_category_tenant_org_slug', ['tenantId', 'organizationId', 'slug'], { unique: true })
export class DocumentCategory extends TenantOrganizationBaseEntity implements IDocumentCategory {
	/**
	 * Display name, unique per organization (case-insensitive, service-enforced).
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(100)
	@MultiORMColumn({ type: 'varchar', length: 100 })
	name: string;

	/**
	 * Kebab-case machine key, unique per tenant/organization.
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MaxLength(150)
	@MultiORMColumn({ type: 'varchar', length: 150 })
	slug: string;

	/**
	 * Hex color for chips.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(32)
	@MultiORMColumn({ type: 'varchar', length: 32, nullable: true })
	color?: string;

	/**
	 * Eva icon name for chips (`nb-icon`).
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	@MultiORMColumn({ nullable: true })
	icon?: string;

	/**
	 * Shown in catalog management UI and used as classification hint text.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	@MultiORMColumn({ type: 'varchar', length: 500, nullable: true })
	description?: string;

	/**
	 * True for seeded defaults; system rows can be renamed/recolored but not deleted (service rule).
	 */
	@ApiProperty({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	@MultiORMColumn({ default: false })
	isSystem: boolean;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Documents assigned to this category — inverse side of `Document.categories`.
	 * Deleting a category deletes only pivot rows, never documents.
	 */
	@MultiORMManyToMany(() => Document, (it) => it.categories)
	documents?: IDocument[];
}
