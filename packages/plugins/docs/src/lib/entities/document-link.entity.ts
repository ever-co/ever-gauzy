import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { BaseEntityEnum, ID, IDocument, IDocumentLink, JsonData } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmDocumentLinkRepository } from '../repositories/mikro-orm-document-link.repository';
import { Document } from './document.entity';

@MultiORMEntity('document_link', { mikroOrmRepository: () => MikroOrmDocumentLinkRepository })
@ColumnIndex('IDX_document_link_unique', ['documentId', 'entity', 'entityId'], { unique: true })
@ColumnIndex('IDX_document_link_tenant_org_entity', ['tenantId', 'organizationId', 'entity', 'entityId'])
@ColumnIndex('IDX_document_link_tenant_org_doc', ['tenantId', 'organizationId', 'documentId'])
export class DocumentLink extends TenantOrganizationBaseEntity implements IDocumentLink {
	/**
	 * The target record type — a `BaseEntityEnum` value (e.g. `'Invoice'`, `'Task'`, `'Employee'`).
	 * No FK — polymorphic by design; validated against the enum.
	 */
	@ApiProperty({ type: () => String, enum: BaseEntityEnum })
	@IsEnum(BaseEntityEnum)
	@MultiORMColumn({ type: 'varchar', length: 50 })
	entity: BaseEntityEnum;

	/**
	 * Target record id. No FK; a deleted target leaves a dangling link that read paths tolerate.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@MultiORMColumn()
	entityId: ID;

	/**
	 * Display label captured at link time (`{ label?, linkedBy? }`) so panels render without
	 * cross-entity joins and survive target deletion. (De)serialized on the SQLite path by the
	 * links service.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text', nullable: true })
	metadata?: JsonData;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The linked document.
	 */
	@MultiORMManyToOne(() => Document, (it) => it.links, {
		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	document?: IDocument;

	/**
	 * The UUID of the linked document.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: DocumentLink) => it.document)
	@MultiORMColumn({ relationId: true })
	documentId: ID;
}
