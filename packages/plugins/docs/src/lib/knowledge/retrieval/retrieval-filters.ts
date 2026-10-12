import { SelectQueryBuilder } from 'typeorm';
import {
	DocumentKnowledgeStatusEnum,
	DocumentReviewReasonEnum,
	DocumentReviewStatusEnum,
	DocumentVisibilityEnum
} from '@gauzy/contracts';
import { prepareSQLQuery as p } from '@gauzy/core';
import { DocumentChunk } from '../../entities/document-chunk.entity';
import { Document } from '../../entities/document.entity';
import { buildShareGrantExistsSql } from '../../services/document-access.sql';
import { IVectorStoreQuery } from '../vector-store/vector-store.interface';

/**
 * The mandatory retrieval filter set (§9.2 of the AI-knowledge spec), applied identically
 * to BOTH legs (lexical and vector) in SQL — never relying on ORM defaults alone.
 * The pure predicate mirror lives in `retrieval-gate.ts` (re-exported here).
 */
export { IRetrievalGateDocument, isBlockedByReviewCircuitBreaker, isRetrievable } from './retrieval-gate';

/**
 * Applies the mandatory + optional filters to a `document_chunk` query builder (alias
 * `chunk`) joined to `document` (alias `doc`). Both retrieval legs share this builder so
 * the filter sets can never drift apart.
 *
 * @param qb A query builder rooted at `DocumentChunk` with alias `chunk`.
 * @param query The store query (tenant/org scope + optional facet filters).
 * @returns The same query builder, filtered.
 */
export function applyRetrievalFilters(
	qb: SelectQueryBuilder<DocumentChunk>,
	query: IVectorStoreQuery
): SelectQueryBuilder<DocumentChunk> {
	const filters = query.filters ?? {};

	qb.innerJoin(Document, 'doc', p(`"doc"."id" = "chunk"."documentId"`));

	// Tenant + organization — on BOTH tables, in SQL (§18.3).
	qb.andWhere(p(`"chunk"."tenantId" = :tenantId`), { tenantId: query.tenantId });
	qb.andWhere(p(`"chunk"."organizationId" = :organizationId`), { organizationId: query.organizationId });
	qb.andWhere(p(`"doc"."tenantId" = :tenantId`), { tenantId: query.tenantId });
	qb.andWhere(p(`"doc"."organizationId" = :organizationId`), { organizationId: query.organizationId });

	// Indexed only (EXCLUDED rows can never match — belt-and-suspenders check stays).
	qb.andWhere(p(`"doc"."knowledgeStatus" = :indexedStatus`), {
		indexedStatus: DocumentKnowledgeStatusEnum.INDEXED
	});
	qb.andWhere(p(`"doc"."knowledgeStatus" != :excludedStatus`), {
		excludedStatus: DocumentKnowledgeStatusEnum.EXCLUDED
	});

	// Not archived / not deleted.
	qb.andWhere(p(`"doc"."isArchived" = :notArchived`), { notArchived: false });
	qb.andWhere(p(`"doc"."deletedAt" IS NULL`));

	// Review circuit breaker (§12): PENDING ai-generated/low-confidence and REJECTED are
	// out; manual and extraction-failed never block retrieval.
	qb.andWhere(
		p(
			`NOT ("doc"."reviewStatus" = :pendingReview AND "doc"."reviewReason" IN (:...blockedReasons))`
		),
		{
			pendingReview: DocumentReviewStatusEnum.PENDING,
			blockedReasons: [DocumentReviewReasonEnum.AI_GENERATED, DocumentReviewReasonEnum.LOW_CONFIDENCE]
		}
	);
	qb.andWhere(p(`"doc"."reviewStatus" != :rejectedReview`), {
		rejectedReview: DocumentReviewStatusEnum.REJECTED
	});

	// Content searchable.
	qb.andWhere(p(`"doc"."searchable" = :searchableFlag`), { searchableFlag: true });

	// Visibility + share composition (08 §3.4): ORGANIZATION docs, own docs, share grantees,
	// or DOCS_MANAGE sees all. The share leg is evaluated in the SAME SQL predicate as
	// visibility so retrieval can never diverge from the list/tree paths.
	if (!filters.hasManagePermission) {
		const legs: string[] = [p(`"doc"."visibility" = :orgVisibility`)];
		const parameters: Record<string, any> = { orgVisibility: DocumentVisibilityEnum.ORGANIZATION };
		if (filters.userId) {
			legs.push(p(`"doc"."createdByUserId" = :visibilityUserId`));
			parameters['visibilityUserId'] = filters.userId;
		}
		if (filters.employeeId) {
			legs.push(buildShareGrantExistsSql('doc'));
			parameters['shareEmployeeId'] = filters.employeeId;
			parameters['shareTenantId'] = query.tenantId;
		}
		qb.andWhere(`(${legs.join(' OR ')})`, parameters);
	}

	// Optional facets.
	if (filters.documentIds?.length) {
		qb.andWhere(p(`"chunk"."documentId" IN (:...filterDocumentIds)`), { filterDocumentIds: filters.documentIds });
	}
	if (filters.kinds?.length) {
		qb.andWhere(p(`"doc"."kind" IN (:...filterKinds)`), { filterKinds: filters.kinds });
	}
	if (filters.categoryIds?.length) {
		qb.andWhere(
			p(
				`EXISTS (SELECT 1 FROM "document_category_document" "dcd" ` +
					`WHERE "dcd"."documentId" = "doc"."id" AND "dcd"."documentCategoryId" IN (:...filterCategoryIds))`
			),
			{ filterCategoryIds: filters.categoryIds }
		);
	}
	if (filters.tagIds?.length) {
		qb.andWhere(
			p(
				`EXISTS (SELECT 1 FROM "tag_document" "td" ` +
					`WHERE "td"."documentId" = "doc"."id" AND "td"."tagId" IN (:...filterTagIds))`
			),
			{ filterTagIds: filters.tagIds }
		);
	}
	if (filters.entity && filters.entityId) {
		qb.andWhere(
			p(
				`EXISTS (SELECT 1 FROM "document_link" "dl" ` +
					`WHERE "dl"."documentId" = "doc"."id" AND "dl"."entity" = :linkEntity AND "dl"."entityId" = :linkEntityId ` +
					`AND "dl"."tenantId" = :tenantId AND "dl"."organizationId" = :organizationId)`
			),
			{ linkEntity: filters.entity, linkEntityId: filters.entityId }
		);
	}

	return qb;
}
