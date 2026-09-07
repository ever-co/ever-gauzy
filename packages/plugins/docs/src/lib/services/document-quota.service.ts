import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantSettingService, prepareSQLQuery as p } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_SETTING_PREFIX, DOCS_SETTING_QUOTA_BYTES } from '../docs.constants';
import { TypeOrmDocumentRepository } from '../repositories/type-orm-document.repository';
import { IDocumentQuotaState, buildQuotaState, isQuotaExceeded, resolveQuotaBytes } from './quota.calculator';

/**
 * Per-organization storage quota (`08-permissions-security.md` §5.7).
 *
 * - Effective quota = org setting `docs.<organizationId>.quotaBytes` when present, else the
 *   deployment default `GAUZY_DOCS_ORG_QUOTA_BYTES`. **`0`/unset = unlimited.**
 * - Usage = `SUM(fileSize)` over **all non-purged** documents of the organization —
 *   archived and soft-deleted (trashed) rows included, because their bytes still exist in
 *   the storage provider.
 * - Uploads reject over quota (`DOCS_QUOTA_EXCEEDED`); system-originated captures
 *   (CHAT/EMAIL) warn and proceed so automated intake never silently drops business records.
 *
 * The arithmetic itself lives in `quota.calculator.ts` (pure, unit-tested); this service is
 * only the I/O around it.
 */
@Injectable()
export class DocumentQuotaService {
	private readonly logger = new Logger(DocumentQuotaService.name);

	constructor(
		private readonly typeOrmDocumentRepository: TypeOrmDocumentRepository,
		private readonly tenantSettingService: TenantSettingService
	) {}

	/**
	 * Resolves the effective quota for one organization.
	 *
	 * @param organizationId The organization scope.
	 * @returns The quota in bytes; `0` = unlimited.
	 */
	async getQuotaBytes(organizationId: ID): Promise<number> {
		const envDefault = getDocsConfig().orgQuotaBytes;
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return envDefault;
		}
		const name = `${DOCS_SETTING_PREFIX}.${organizationId}.${DOCS_SETTING_QUOTA_BYTES}`;
		try {
			const stored = await this.tenantSettingService.getSettings({ where: { name: In([name]), tenantId } });
			return resolveQuotaBytes(stored?.[name], envDefault);
		} catch (error) {
			// A settings read failure must not invent a quota out of thin air — fall back to
			// the deployment default rather than blocking or unblocking uploads at random.
			this.logger.warn(`Failed to read the documents storage quota: ${(error as Error).message}`);
			return envDefault;
		}
	}

	/**
	 * Current storage usage of one organization: `SUM(fileSize)` over every non-purged
	 * document row (archived + soft-deleted included).
	 *
	 * @param organizationId The organization scope.
	 * @returns The used bytes (0 when nothing is stored or the query fails).
	 */
	async getUsedBytes(organizationId: ID): Promise<number> {
		const tenantId = RequestContext.currentTenantId();
		try {
			const qb = this.typeOrmDocumentRepository.createQueryBuilder('document');
			qb.select('COALESCE(SUM(document.fileSize), 0)', 'usedBytes');
			qb.withDeleted(); // trashed rows still occupy provider bytes
			qb.where(p(`"document"."organizationId" = :organizationId`), { organizationId });
			if (tenantId) {
				qb.andWhere(p(`"document"."tenantId" = :tenantId`), { tenantId });
			}
			const row = await qb.getRawOne();
			return Number(row?.usedBytes ?? 0) || 0;
		} catch (error) {
			this.logger.warn(`Failed to compute documents storage usage: ${(error as Error).message}`);
			return 0;
		}
	}

	/**
	 * The quota block reported by `GET /plugins/docs/settings`.
	 *
	 * @param organizationId The organization scope.
	 * @returns Quota, usage, remaining bytes, and the unlimited flag.
	 */
	async getQuotaState(organizationId: ID): Promise<IDocumentQuotaState> {
		const [quotaBytes, usedBytes] = await Promise.all([
			this.getQuotaBytes(organizationId),
			this.getUsedBytes(organizationId)
		]);
		return buildQuotaState(usedBytes, quotaBytes);
	}

	/**
	 * Whether accepting `incomingBytes` more would exceed the organization quota.
	 *
	 * @param incomingBytes The bytes about to be stored.
	 * @param state The already-resolved quota state (avoids re-querying per file in a batch).
	 * @returns True when the write must be rejected.
	 */
	exceeds(incomingBytes: number, state: IDocumentQuotaState): boolean {
		return isQuotaExceeded(state.usedBytes, incomingBytes, state.quotaBytes);
	}
}
