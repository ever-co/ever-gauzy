import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { DocumentVisibilityEnum, ID } from '@gauzy/contracts';
import { RequestContext, TenantSettingService } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_SETTING_PREFIX, DOCS_SETTING_QUOTA_BYTES } from '../docs.constants';
import { DocumentSettingsDTO, IDocumentSettings, IDocumentSettingsDefaults } from '../dto/document-settings.dto';
import { DocumentQuotaService } from './document-quota.service';
import { resolveQuotaBytes } from './quota.calculator';

/**
 * File types accepted by the upload endpoint (sniffed, never trusted from the client header).
 */
const DOCS_ACCEPTED_TYPES = [
	'pdf',
	'docx',
	'xlsx',
	'pptx',
	'odt',
	'ods',
	'csv',
	'txt',
	'md',
	'html',
	'png',
	'jpg',
	'webp',
	'gif'
];

/**
 * Org-default settings persisted as namespaced rows in the core `tenant_setting` table
 * (`name: 'docs.<organizationId>.<key>'`), plus the read-only deployment capabilities block.
 */
@Injectable()
export class DocumentSettingsService {
	private readonly logger = new Logger(DocumentSettingsService.name);

	constructor(
		private readonly tenantSettingService: TenantSettingService,
		private readonly documentQuotaService: DocumentQuotaService
	) {}

	/**
	 * Reads the org defaults + deployment capabilities + the live storage-quota state.
	 *
	 * @param organizationId The organization scope.
	 * @returns The settings envelope.
	 */
	async getSettings(organizationId: ID): Promise<IDocumentSettings> {
		const [defaults, quota] = await Promise.all([
			this.getDefaults(organizationId),
			this.documentQuotaService.getQuotaState(organizationId)
		]);
		const config = getDocsConfig();

		return {
			defaults,
			capabilities: {
				aiEnabled: config.aiEnabled,
				// pgvector capability probing arrives with the knowledge service (M3);
				// until then the deployment honestly reports lexical-only.
				vectorSearch: false,
				embeddingModel: config.embeddingModel,
				maxFileSize: config.maxFileSize,
				acceptedTypes: DOCS_ACCEPTED_TYPES,
				inboundEmailEnabled: config.inboundEmailEnabled
			},
			quota
		};
	}

	/**
	 * Partial update of the org-defaults block only (`capabilities` is never writable).
	 *
	 * @param organizationId The organization scope.
	 * @param input The defaults to update.
	 * @returns The updated settings envelope.
	 */
	async updateSettings(organizationId: ID, input: DocumentSettingsDTO): Promise<IDocumentSettings> {
		const tenantId = RequestContext.currentTenantId();

		const settings: Record<string, string> = {};
		if (input.importToKnowledgeDefault !== undefined) {
			settings[this.key(organizationId, 'importToKnowledgeDefault')] = String(input.importToKnowledgeDefault);
		}
		if (input.defaultVisibility !== undefined) {
			settings[this.key(organizationId, 'defaultVisibility')] = input.defaultVisibility;
		}
		if (input.autoClassify !== undefined) {
			settings[this.key(organizationId, 'autoClassify')] = String(input.autoClassify);
		}
		if (input.quotaBytes !== undefined) {
			// Stored verbatim (including an explicit "0" = unlimited for this organization).
			settings[this.key(organizationId, DOCS_SETTING_QUOTA_BYTES)] = String(input.quotaBytes);
		}

		if (Object.keys(settings).length > 0) {
			await this.tenantSettingService.saveSettings(settings, tenantId);
		}

		return this.getSettings(organizationId);
	}

	/**
	 * Reads the org-defaults block with documented fallbacks.
	 *
	 * @param organizationId The organization scope.
	 * @returns The defaults block.
	 */
	async getDefaults(organizationId: ID): Promise<IDocumentSettingsDefaults> {
		const tenantId = RequestContext.currentTenantId();
		const names = ['importToKnowledgeDefault', 'defaultVisibility', 'autoClassify', DOCS_SETTING_QUOTA_BYTES].map(
			(key) => this.key(organizationId, key)
		);

		let stored: Record<string, any> = {};
		try {
			stored = await this.tenantSettingService.getSettings({ where: { name: In(names), tenantId } });
		} catch (error) {
			this.logger.warn(`Failed to read document settings: ${(error as Error).message}`);
		}

		return {
			importToKnowledgeDefault: stored[this.key(organizationId, 'importToKnowledgeDefault')] === 'true',
			defaultVisibility:
				(stored[this.key(organizationId, 'defaultVisibility')] as DocumentVisibilityEnum) ??
				DocumentVisibilityEnum.ORGANIZATION,
			autoClassify: stored[this.key(organizationId, 'autoClassify')] !== 'false',
			quotaBytes: resolveQuotaBytes(
				stored[this.key(organizationId, DOCS_SETTING_QUOTA_BYTES)],
				getDocsConfig().orgQuotaBytes
			)
		};
	}

	/**
	 * Builds the namespaced `tenant_setting` row name for one org default.
	 */
	private key(organizationId: ID, key: string): string {
		return `${DOCS_SETTING_PREFIX}.${organizationId}.${key}`;
	}
}
