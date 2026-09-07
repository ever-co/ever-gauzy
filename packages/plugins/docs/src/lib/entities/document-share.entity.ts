import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { DocumentShareAccessEnum, ID, IDocument, IDocumentShare, IEmployee, IOrganizationTeam } from '@gauzy/contracts';
import {
	ColumnIndex,
	Employee,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	OrganizationTeam,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmDocumentShareRepository } from '../repositories/mikro-orm-document-share.repository';
import { Document } from './document.entity';

@MultiORMEntity('document_share', { mikroOrmRepository: () => MikroOrmDocumentShareRepository })
@ColumnIndex('IDX_document_share_tenant_org_doc', ['tenantId', 'organizationId', 'documentId'])
export class DocumentShare extends TenantOrganizationBaseEntity implements IDocumentShare {
	/**
	 * Access level granted: `VIEW` | `COMMENT` | `EDIT`.
	 */
	@ApiProperty({ type: () => String, enum: DocumentShareAccessEnum })
	@IsEnum(DocumentShareAccessEnum)
	@MultiORMColumn({ type: 'varchar', length: 16, default: DocumentShareAccessEnum.VIEW })
	access: DocumentShareAccessEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * The shared (PRIVATE) document.
	 */
	@MultiORMManyToOne(() => Document, (it) => it.shares, {
		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	document?: IDocument;

	/**
	 * The UUID of the shared document.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: DocumentShare) => it.document)
	@MultiORMColumn({ relationId: true })
	documentId: ID;

	/**
	 * Employee grantee — exactly one of `employeeId` / `teamId` is set per row (XOR, enforced by
	 * the `CHK_document_share_target_xor` CHECK constraint and by DTO validation).
	 */
	@MultiORMManyToOne(() => Employee, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	employee?: IEmployee;

	/**
	 * The UUID of the grantee Employee.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DocumentShare) => it.employee)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	employeeId?: ID;

	/**
	 * Team grantee — the other half of the XOR pair.
	 */
	@MultiORMManyToOne(() => OrganizationTeam, {
		/** Specifies whether the relation column can have null values. */
		nullable: true,

		/** Specifies the action to take when the related entity is deleted. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	team?: IOrganizationTeam;

	/**
	 * The UUID of the grantee team.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: DocumentShare) => it.team)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	teamId?: ID;
}
