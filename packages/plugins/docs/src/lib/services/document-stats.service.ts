import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { DocumentReviewStatusEnum, DocumentStatusEnum, ID } from '@gauzy/contracts';
import { RequestContext, prepareSQLQuery as p } from '@gauzy/core';
import { GetDocumentsQueryDTO } from '../dto';
import { Document } from '../entities/document.entity';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { DocumentQuotaService } from './document-quota.service';
import { DocumentService } from './document.service';
import { IDocumentQuotaState } from './quota.calculator';

/** Response of `GET /plugins/docs/documents/stats` — the browse page's stats tiles. */
export interface IDocumentStats {
	/** Non-archived documents in the organization scope. */
	total: number;
	/** Counts per RAW status — the UI folds UPLOADED into PROCESSING, same as the facets. */
	byStatus: Partial<Record<DocumentStatusEnum, number>>;
	/** `reviewStatus = PENDING` count — the same predicate as the needs-review preset. */
	needsReview: number;
	/** Same shape as the settings quota block; `quotaBytes: 0` = unlimited. */
	storage: IDocumentQuotaState;
}

/**
 * Org-global counts for the Documents-hub stats tiles.
 *
 * Deliberately NOT the facets endpoint: `getDocumentFacets` costs ~11 GROUP BY /
 * count queries per call and its numbers are filter-relative (each facet computed
 * over the OTHER filters), so tile numbers would shift as filters change. This is
 * three cheap queries whose numbers only move when documents do.
 *
 * Scope semantics: tenant + organization + the caller's visibility predicate,
 * archived rows excluded — i.e. exactly what the "All" preset counts. Filters on
 * the DTO beyond the mandatory `where` scope are intentionally ignored.
 */
@Injectable()
export class DocumentStatsService {
	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly documentService: DocumentService,
		private readonly documentQuotaService: DocumentQuotaService
	) {}

	/**
	 * Computes the stats envelope for one organization.
	 *
	 * @param params The validated query DTO — only the `where` organization scope is read.
	 * @returns Totals by status, the needs-review count and the storage quota state.
	 */
	async getDocumentStats(params: GetDocumentsQueryDTO): Promise<IDocumentStats> {
		// Same fallback chain as the list path: `whitelist: true` strips a top-level
		// organizationId, so the scope lives in `where` (or the request context).
		const organizationId = this.documentService.resolveOrganizationId(params as any);

		const [statusRows, needsReview, storage] = await Promise.all([
			this.buildScopedQuery(organizationId)
				.select('document.status', 'value')
				.addSelect('COUNT(*)', 'count')
				.groupBy('document.status')
				.getRawMany(),
			this.buildScopedQuery(organizationId)
				.andWhere(p(`"document"."reviewStatus" = :pendingReview`), {
					pendingReview: DocumentReviewStatusEnum.PENDING
				})
				.getCount(),
			this.documentQuotaService.getQuotaState(organizationId)
		]);

		const byStatus: Partial<Record<DocumentStatusEnum, number>> = {};
		let total = 0;
		for (const row of statusRows as { value: DocumentStatusEnum | null; count: string | number }[]) {
			if (row.value === null || row.value === undefined) continue;
			const count = Number(row.count) || 0;
			byStatus[row.value] = count;
			total += count;
		}

		return { total, byStatus, needsReview, storage };
	}

	/**
	 * The tile scope: tenant + organization + visibility predicate, archived excluded.
	 * Mirrors what `DocumentService.buildFilteredQuery` produces for an empty filter
	 * set (that builder is private; the two public scope helpers keep this in sync).
	 */
	private buildScopedQuery(organizationId: ID): SelectQueryBuilder<Document> {
		const tenantId = RequestContext.currentTenantId();
		const qb = this.typeOrmDocumentRepository.createQueryBuilder('document');
		qb.where(p(`"document"."tenantId" = :tenantId`), { tenantId });
		qb.andWhere(p(`"document"."organizationId" = :organizationId`), { organizationId });
		this.documentService.applyVisibilityScope(qb);
		qb.andWhere(p(`"document"."isArchived" = :isArchived`), { isArchived: false });
		return qb;
	}
}
