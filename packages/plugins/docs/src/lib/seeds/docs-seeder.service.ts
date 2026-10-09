import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import { DataSource } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import {
	DocumentKindEnum,
	DocumentKnowledgeStatusEnum,
	DocumentSourceEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum,
	IOrganization,
	ITenant
} from '@gauzy/contracts';
import { SeedDataService, getDefaultOrganizations } from '@gauzy/core';
import { Document } from '../entities/document.entity';
import { DocumentCategory } from '../entities/document-category.entity';
import { DEFAULT_DOCUMENT_CATEGORIES } from './default-categories';
import {
	STARTER_FOLDER,
	STARTER_PAGE_CONTENT_HTML,
	STARTER_PAGE_CONTENT_JSON,
	STARTER_PAGE_ICON,
	STARTER_PAGE_NAME
} from './initial-content';

/**
 * Seeds the Documents plugin defaults through the plugin lifecycle
 * (`DocsPlugin implements IOnPluginSeedable`), per tenant + organization, **idempotently**
 * (every step probes before inserting). Seeds never enqueue processing jobs and never call
 * AI providers.
 */
@Injectable()
export class DocsSeederService {
	private readonly logger = new Logger(DocsSeederService.name);

	constructor(private readonly seeder: SeedDataService) {}

	/**
	 * Reserved — no-op in v1 (invoked by `onPluginBasicSeed`).
	 */
	async seedBasic(): Promise<void> {
		// Reserved for future basic-seed content
	}

	/**
	 * Default seed: the 11 system categories per organization (probe by slug — user renames
	 * survive) + the starter "Company Library" folder and welcome page (only into an organization
	 * with zero `document` rows).
	 */
	async seedDefault(): Promise<void> {
		const { dataSource, tenant } = this.seeder;
		const organizations = await getDefaultOrganizations(dataSource, tenant);

		for (const organization of organizations ?? []) {
			await this.seedOrganization(dataSource, tenant, organization);
		}
	}

	/**
	 * Random (demo) seed: per organization, 2 demo folders holding a few FILE rows with
	 * plausible metadata + 2 lorem PAGE documents — enough for every filter chip to have data.
	 * No real blobs are written; demo FILE rows are flagged `metadata.demo: true`.
	 */
	async seedRandom(): Promise<void> {
		const { dataSource, tenant } = this.seeder;
		const organizations = await getDefaultOrganizations(dataSource, tenant);

		for (const organization of organizations ?? []) {
			await this.seedDemoDocuments(dataSource, tenant, organization);
		}
	}

	/**
	 * Seeds one organization: categories, then starter content.
	 */
	private async seedOrganization(dataSource: DataSource, tenant: ITenant, organization: IOrganization): Promise<void> {
		const categoryRepository = dataSource.getRepository(DocumentCategory);
		const documentRepository = dataSource.getRepository(Document);

		// 1) System categories — skip any slug that already exists in the org (safe re-seed)
		for (const definition of DEFAULT_DOCUMENT_CATEGORIES) {
			const exists = await categoryRepository.findOne({
				where: { tenantId: tenant.id, organizationId: organization.id, slug: definition.slug },
				withDeleted: true
			});
			if (!exists) {
				await categoryRepository.save(
					categoryRepository.create({
						tenantId: tenant.id,
						organizationId: organization.id,
						name: definition.name,
						slug: definition.slug,
						color: definition.color,
						icon: definition.icon,
						isSystem: true
					})
				);
			}
		}

		// 2) Starter content — only when the organization has zero document rows
		const documentCount = await documentRepository.count({
			where: { tenantId: tenant.id, organizationId: organization.id },
			withDeleted: true
		});
		if (documentCount > 0) {
			return; // Idempotency guard — re-runs are no-ops
		}

		const folder = await documentRepository.save(
			documentRepository.create({
				tenantId: tenant.id,
				organizationId: organization.id,
				kind: DocumentKindEnum.FOLDER,
				name: STARTER_FOLDER.name,
				icon: STARTER_FOLDER.icon,
				index: 0,
				status: DocumentStatusEnum.READY,
				source: DocumentSourceEnum.SYSTEM,
				visibility: DocumentVisibilityEnum.ORGANIZATION,
				knowledgeStatus: DocumentKnowledgeStatusEnum.NONE
			})
		);

		await documentRepository.save(
			documentRepository.create({
				tenantId: tenant.id,
				organizationId: organization.id,
				kind: DocumentKindEnum.PAGE,
				parentId: folder.id,
				name: STARTER_PAGE_NAME,
				icon: STARTER_PAGE_ICON,
				index: 0,
				contentJson: this.serializeJson(STARTER_PAGE_CONTENT_JSON),
				contentHtml: STARTER_PAGE_CONTENT_HTML,
				status: DocumentStatusEnum.READY,
				source: DocumentSourceEnum.SYSTEM,
				visibility: DocumentVisibilityEnum.ORGANIZATION,
				knowledgeStatus: DocumentKnowledgeStatusEnum.NONE,
				searchable: true
			})
		);

		this.logger.log(`Seeded Documents starter content for organization ${organization.id}`);
	}

	/**
	 * Seeds lightweight demo documents for one organization (random seed phase).
	 */
	private async seedDemoDocuments(dataSource: DataSource, tenant: ITenant, organization: IOrganization): Promise<void> {
		const documentRepository = dataSource.getRepository(Document);
		const demoMimeTypes = ['application/pdf', 'text/csv', 'image/png'];

		for (let folderIndex = 0; folderIndex < 2; folderIndex++) {
			const folder = await documentRepository.save(
				documentRepository.create({
					tenantId: tenant.id,
					organizationId: organization.id,
					kind: DocumentKindEnum.FOLDER,
					name: `Demo Folder ${folderIndex + 1}`,
					index: folderIndex + 1,
					status: DocumentStatusEnum.READY,
					source: DocumentSourceEnum.SYSTEM,
					visibility: DocumentVisibilityEnum.ORGANIZATION
				})
			);

			// How many demo files this folder gets. Cosmetic variety in seed data only — never a
			// secret or an access decision — but drawn from the CSPRNG so rule S2245 does not
			// have to be re-litigated at every future reader.
			const fileCount = randomInt(3, 7); // 3–6 files
			for (let fileIndex = 0; fileIndex < fileCount; fileIndex++) {
				await documentRepository.save(
					documentRepository.create({
						tenantId: tenant.id,
						organizationId: organization.id,
						kind: DocumentKindEnum.FILE,
						parentId: folder.id,
						name: `Demo Document ${folderIndex + 1}-${fileIndex + 1}`,
						index: fileIndex,
						mimeType: demoMimeTypes[fileIndex % demoMimeTypes.length],
						fileSize: 1024 * (fileIndex + 1),
						originalFilename: `demo-${folderIndex + 1}-${fileIndex + 1}.pdf`,
						extractedText: 'Demo extracted text used to exercise the search facets.',
						status: DocumentStatusEnum.READY,
						source: DocumentSourceEnum.UPLOAD,
						visibility: DocumentVisibilityEnum.ORGANIZATION,
						knowledgeStatus:
							fileIndex % 2 === 0 ? DocumentKnowledgeStatusEnum.INDEXED : DocumentKnowledgeStatusEnum.NONE,
						metadata: this.serializeJson({ demo: true })
					})
				);
			}
		}

		for (let pageIndex = 0; pageIndex < 2; pageIndex++) {
			await documentRepository.save(
				documentRepository.create({
					tenantId: tenant.id,
					organizationId: organization.id,
					kind: DocumentKindEnum.PAGE,
					name: `Demo Page ${pageIndex + 1}`,
					index: 10 + pageIndex,
					contentJson: this.serializeJson({
						type: 'doc',
						content: [
							{
								type: 'paragraph',
								content: [{ type: 'text', text: 'Lorem ipsum demo page content.' }]
							}
						]
					}),
					contentHtml: '<p>Lorem ipsum demo page content.</p>',
					status: DocumentStatusEnum.READY,
					source: DocumentSourceEnum.EDITOR,
					visibility: DocumentVisibilityEnum.ORGANIZATION
				})
			);
		}

		this.logger.log(`Seeded Documents demo content for organization ${organization.id}`);
	}

	/**
	 * Serializes JSON columns for the SQLite path (seed writes may bypass the subscriber's
	 * per-connection registration order, so serialization is applied defensively here).
	 */
	private serializeJson(value: Record<string, any>): any {
		return isSqlite() || isBetterSqlite3() ? JSON.stringify(value) : value;
	}
}
