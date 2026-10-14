import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { FindOptionsWhere, IsNull } from 'typeorm';
import { ID, ISearchIndexField, ISearchIndexRegistration, JsonData } from '@gauzy/contracts';
import {
	CrudService,
	MikroOrmSearchIndexDefinitionRepository,
	RequestContext,
	SearchIndexDefinition,
	TypeOrmSearchIndexDefinitionRepository
} from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SEARCH_INDEX_DEFINITIONS } from '../definitions';

/** The fields of a declaration an operator may change, and which bump the version when they do. */
interface IDefinitionShape {
	fields: ISearchIndexField[];
	titleTemplate?: string;
	bodyTemplate?: string;
	keywordFields?: string[];
	defaultWeight: number;
	sourceUpdatedAtField: string;
}

/**
 * The persisted half of the index declarations.
 *
 * A declaration is written once, in the package that owns the entity, and it is code: which fields
 * exist and where their values are read from cannot be decided by an operator, because a field that
 * does not exist on the entity produces an index that silently never matches. What an operator *can*
 * decide is how much each field counts, and that is what lives in this table — the weights, the
 * templates, the promoted fields and whether the entity is indexed at all.
 *
 * The service keeps the two halves in step. On boot it makes one platform row per registered
 * declaration, creating what is missing and merging what has drifted: the code owns the field set,
 * the row owns the weights and everything else an operator tunes, and **an operator's override wins**
 * once a row exists. It bumps the row's `version` whenever the effective shape changes, and a document
 * carries the version it was built at — so a re-weighted declaration is rebuilt by the next sweep
 * without an operator asking for a full reindex.
 *
 * Every write is scoped by the caller's tenant and organization, and a read admits the caller's own
 * rows plus the platform rows that have neither — which is what lets a shipped declaration be
 * overridden per organization without being copied into every tenant.
 */
@Injectable()
export class SearchIndexDefinitionService extends CrudService<SearchIndexDefinition> implements OnApplicationBootstrap {
	private readonly logger = new Logger(SearchIndexDefinitionService.name);

	constructor(
		readonly typeOrmSearchIndexDefinitionRepository: TypeOrmSearchIndexDefinitionRepository,
		readonly mikroOrmSearchIndexDefinitionRepository: MikroOrmSearchIndexDefinitionRepository,
		private readonly indexRegistry: SearchIndexRegistry
	) {
		super(typeOrmSearchIndexDefinitionRepository, mikroOrmSearchIndexDefinitionRepository);
	}

	/**
	 * Makes the platform's own rows match the declarations this installation registered.
	 *
	 * The registration is what decides which entities are searchable, and it is filtered to the
	 * declarations whose source table this connection actually maps: a declaration for a package that
	 * is not installed describes a class of rows that does not exist, and writing a row for it would
	 * put an entity in the search configuration screen that can never return anything.
	 */
	onApplicationBootstrap(): void {
		try {
			this.indexRegistry.registerShipped(SEARCH_INDEX_DEFINITIONS);
			// The synchronisation is deliberately not awaited: it is a boot-time reconciliation with the
			// database, and making the whole application wait for it would put a schema query on the
			// critical path of every start. Its failure is reported rather than thrown, because an
			// installation whose declarations could not be written still searches with the declarations
			// it holds in code.
			this.syncFromRegistry().catch((error) =>
				this.logger.error(`The search index definitions could not be synchronised: ${describe(error)}`)
			);
		} catch (error) {
			// A definition that cannot be synchronised must not stop the platform from booting: search
			// degrades to "the declarations in code", which is a working index, not a broken one.
			this.logger.error(`The search index definitions could not be synchronised: ${describe(error)}`);
		}
	}

	/**
	 * Writes the registered declarations into the table.
	 *
	 * **What the code owns and what the row owns is the whole design of this method.** The declaration
	 * in code owns the field *set*: which fields exist, what kind each one holds and where its value is
	 * read from. Those are facts about the entity, and an operator cannot be allowed to state them,
	 * because a field that does not exist on the entity produces an index that silently never matches.
	 * The persisted row owns everything an operator tunes: the weights, the searchable, filterable and
	 * facetable flags, the templates, the promoted fields, the default weight, the source timestamp
	 * column, the label and whether the entity is indexed at all.
	 *
	 * So this is a merge and not an overwrite, and the consequence is stated because it is the thing a
	 * maintainer will look for: **once an operator has tuned a row, a change to the corresponding
	 * value in code no longer lands** — the override wins until it is cleared. A change to the field set
	 * always lands, because the field set is not an operator's to state.
	 *
	 * The version is bumped only when the *effective* shape changed. That distinction is the whole
	 * reason the version exists: a developer adding a field must invalidate the documents built
	 * without it, and a boot that re-reads an unchanged declaration must not.
	 *
	 * @returns How many rows were created and how many were updated.
	 */
	async syncFromRegistry(): Promise<{ created: number; updated: number }> {
		const repository = this.typeOrmSearchIndexDefinitionRepository;
		let created = 0;
		let updated = 0;

		for (const declaration of this.indexRegistry.getAll()) {
			const existing = await repository.findOne({
				where: { entity: declaration.entity, organizationId: IsNull(), engineKey: IsNull() } as any,
				withDeleted: true
			});

			if (!existing) {
				await repository.save(this.createRow(repository.create(), declaration));
				created += 1;
				continue;
			}

			const before = this.serialiseShape(this.shapeOfRow(existing));

			this.applyDeclaration(existing, declaration);

			const after = this.serialiseShape(this.shapeOfRow(existing));

			if (before !== after) {
				existing.version = Math.max(1, Number(existing.version) || 1) + 1;
			}

			// A declaration that comes back — a package reinstalled — reactivates the row it owns, and the
			// documents that were retained while it was gone are rebuilt by the next sweep.
			existing.deletedAt = null;
			await repository.save(existing);
			updated += 1;
		}

		if (created > 0 || updated > 0) {
			this.logger.log(`The search index definitions are synchronised: ${created} created, ${updated} updated.`);
		}

		return { created, updated };
	}

	/**
	 * The definition in force for one entity.
	 *
	 * An organization's own row wins; the platform row is the fallback. That order is what lets a
	 * tenant re-weight a shipped declaration without every other tenant inheriting the change.
	 *
	 * @param entity The entity key.
	 * @param organizationId The organization to resolve for; the caller's own when it states none.
	 * @returns The row, or `null` when the entity has no persisted definition.
	 */
	async findFor(entity: string, organizationId?: ID | null): Promise<SearchIndexDefinition | null> {
		const organization = organizationId ?? RequestContext.currentOrganizationId() ?? null;
		const repository = this.typeOrmSearchIndexDefinitionRepository;

		if (organization) {
			const scoped = await repository.findOne({
				where: { entity, organizationId: organization as string } as any
			});

			if (scoped) {
				return scoped;
			}
		}

		return await repository.findOne({ where: { entity, organizationId: IsNull() } as any });
	}

	/**
	 * The definitions a caller may see: its organization's rows and the platform's.
	 *
	 * @param entity Narrows the list to one entity.
	 * @returns The rows, platform rows first.
	 */
	async list(entity?: string): Promise<SearchIndexDefinition[]> {
		const organization = RequestContext.currentOrganizationId() ?? null;
		const where: FindOptionsWhere<SearchIndexDefinition>[] = [
			{ organizationId: IsNull(), ...(entity ? { entity } : {}) } as any
		];

		if (organization) {
			where.push({ organizationId: organization as string, ...(entity ? { entity } : {}) } as any);
		}

		return await this.typeOrmSearchIndexDefinitionRepository.find({
			where,
			order: { entity: 'ASC' } as any
		});
	}

	/**
	 * One definition by id, scoped to what the caller may see.
	 *
	 * **The scope is in the query, and it is not conditional.** The lookup used to carry no predicate
	 * at all and the guard that followed it required *both* the row's organization and the caller's to
	 * be present — so a caller who had never selected an organization (`lastOrganizationId` is null
	 * until they do) read any definition row in the installation, including another tenant's
	 * organization-specific one with its fields, promoted fields and source configuration. There was
	 * no tenant comparison anywhere in the method, and this is the method `updateDefinition` and every
	 * `SEARCH_INDEX_DEFINITIONS_EDIT` route resolve through, so the same id reached the writer.
	 *
	 * A platform row — one with no organization — stays readable by every caller in its tenant,
	 * because that is what a shipped declaration is. An organization-specific row is bound to the
	 * caller's tenant *and* organization. A caller with no tenant at all is refused rather than
	 * widened: the whole table is one tenant boundary away from being shared.
	 *
	 * @param id The row.
	 * @returns The row.
	 * @throws NotFoundException when it is not the caller's.
	 */
	async findOneScoped(id: ID): Promise<SearchIndexDefinition> {
		const tenantId = RequestContext.currentTenantId() ?? null;
		const organization = RequestContext.currentOrganizationId() ?? null;

		if (!tenantId) {
			throw new NotFoundException(`No search index definition has the id "${id}".`);
		}

		const where: FindOptionsWhere<SearchIndexDefinition>[] = [
			{ id, tenantId, organizationId: IsNull() } as any,
			// A shipped row is seeded without a tenant, and it is the platform's rather than anybody's:
			// it stays readable, and `isSystem` is what stops it from being deleted.
			{ id, tenantId: IsNull(), organizationId: IsNull() } as any
		];

		if (organization) {
			where.push({ id, tenantId, organizationId: organization as string } as any);
		}

		const row = await this.typeOrmSearchIndexDefinitionRepository.findOne({ where });

		if (!row) {
			throw new NotFoundException(`No search index definition has the id "${id}".`);
		}

		return row;
	}

	/**
	 * Re-weights a definition, or turns it off.
	 *
	 * Only the half an operator owns is writable. `entity`, `isSystem` and the version are not: the
	 * first names the class of rows the declaration describes, the second is what stops a shipped
	 * declaration from being deleted, and the third is derived from what changed rather than stated.
	 *
	 * @param id The row.
	 * @param changes The fields to change.
	 * @returns The updated row.
	 * @throws BadRequestException when nothing writable was supplied.
	 */
	async updateDefinition(
		id: ID,
		changes: {
			label?: string;
			fields?: ISearchIndexField[];
			titleTemplate?: string;
			bodyTemplate?: string;
			keywordFields?: string[];
			defaultWeight?: number;
			sourceUpdatedAtField?: string;
			isActive?: boolean;
			metadata?: JsonData;
		}
	): Promise<SearchIndexDefinition> {
		const row = await this.findOneScoped(id);
		const shapeBefore = this.serialiseShape(this.shapeOfRow(row));

		if (changes.label !== undefined) {
			row.label = String(changes.label);
		}

		if (changes.fields !== undefined) {
			row.fields = this.validateFields(row.entity, changes.fields);
		}

		if (changes.titleTemplate !== undefined) {
			row.titleTemplate = changes.titleTemplate || undefined;
		}

		if (changes.bodyTemplate !== undefined) {
			row.bodyTemplate = changes.bodyTemplate || undefined;
		}

		if (changes.keywordFields !== undefined) {
			row.keywordFields = this.validateKeywordFields(row, changes.keywordFields);
		}

		if (changes.defaultWeight !== undefined) {
			row.defaultWeight = String(Math.max(0, Number(changes.defaultWeight) || 0)) as any;
		}

		if (changes.sourceUpdatedAtField !== undefined) {
			row.sourceUpdatedAtField = String(changes.sourceUpdatedAtField || 'updatedAt');
		}

		if (changes.isActive !== undefined) {
			row.isActive = Boolean(changes.isActive);
		}

		if (changes.metadata !== undefined) {
			row.metadata = changes.metadata;
		}

		const shapeAfter = this.serialiseShape(this.shapeOfRow(row));

		if (shapeBefore !== shapeAfter) {
			// The index is built from the shape, so a document built at the old one is rebuilt at the new
			// one by the next sweep. Bumping the version is what makes that happen without a full reindex.
			row.version = Math.max(1, Number(row.version) || 1) + 1;
		}

		return await this.typeOrmSearchIndexDefinitionRepository.save(row);
	}

	/**
	 * Turns a definition off without deleting it.
	 *
	 * Documents are retained, so re-activating an entity does not need a rebuild before it answers
	 * again. This is the only "removal" a shipped declaration supports.
	 *
	 * @param id The row.
	 * @returns The deactivated row.
	 */
	async deactivate(id: ID): Promise<SearchIndexDefinition> {
		return await this.updateDefinition(id, { isActive: false });
	}

	/**
	 * Deletes a definition an operator authored.
	 *
	 * A shipped definition is refused rather than protected silently: an operator who may re-weight a
	 * declaration must not be able to remove an entity from every search in the tenant, and the
	 * refusal says which of the two they are looking at.
	 *
	 * @param id The row.
	 * @returns What was removed.
	 * @throws BadRequestException when the row is a shipped definition.
	 */
	async removeDefinition(id: ID): Promise<{ id: ID; deleted: boolean }> {
		const row = await this.findOneScoped(id);

		if (row.isSystem) {
			throw new BadRequestException(
				`The "${row.entity}" index definition is shipped by the package that owns the entity and cannot ` +
					'be deleted. Deactivate it instead: its documents are retained, so re-activating it does not ' +
					'need a rebuild.'
			);
		}

		await this.typeOrmSearchIndexDefinitionRepository.softDelete({ id } as any);

		return { id, deleted: true };
	}

	/**
	 * The version documents of one entity are stamped with.
	 *
	 * @param entity The entity key.
	 * @returns The version in force, or one when no row exists.
	 */
	async versionOf(entity: string): Promise<number> {
		const row = await this.findFor(entity);

		return Math.max(1, Number(row?.version) || 1);
	}

	/**
	 * Rejects a field list that could never produce a usable index.
	 *
	 * The rules are the same ones the in-memory registry applies, restated here because this is the
	 * path an operator writes through and the registry never sees that input.
	 *
	 * @param entity The entity key, for the message.
	 * @param fields The declared fields.
	 * @returns The fields.
	 * @throws BadRequestException naming the rule the list breaks.
	 */
	private validateFields(entity: string, fields: ISearchIndexField[]): ISearchIndexField[] {
		if (!Array.isArray(fields) || fields.length === 0) {
			throw new BadRequestException(
				`An active index definition for "${entity}" must declare at least one field, or it could only ` +
					'index nothing.'
			);
		}

		const names = new Set<string>();

		for (const field of fields) {
			const name = String(field?.name ?? '').trim();

			if (!name) {
				throw new BadRequestException(`An index definition for "${entity}" declares a field with no name.`);
			}

			if (names.has(name)) {
				throw new BadRequestException(
					`The index definition for "${entity}" declares the field "${name}" twice. A filter, a facet ` +
						'and a sort all address a field by name, so two fields behind one name would be ' +
						'indistinguishable.'
				);
			}

			names.add(name);
		}

		return fields;
	}

	/**
	 * Rejects promoted fields that no declared field provides.
	 *
	 * @param row The definition.
	 * @param keywordFields The promoted field names.
	 * @returns The promoted field names.
	 * @throws BadRequestException when one of them is not declared.
	 */
	private validateKeywordFields(row: SearchIndexDefinition, keywordFields: string[]): string[] {
		const declared = new Set((row.fields ?? []).map((field) => field.name));

		for (const name of keywordFields ?? []) {
			if (!declared.has(name)) {
				throw new BadRequestException(
					`The index definition for "${row.entity}" promotes "${name}" into its keywords, but no field ` +
						'of that name is declared.'
				);
			}
		}

		return keywordFields ?? [];
	}

	/**
	 * Fills a new row from a declaration.
	 *
	 * Every value comes from the declaration, because a row that does not exist yet has nothing an
	 * operator could have tuned. The engine key is left null on purpose: which backend holds an entity's
	 * documents is an installation's choice rather than a fact about the entity, so a declaration in
	 * code never states one.
	 *
	 * @param row The new row.
	 * @param declaration The declaration.
	 * @returns The row.
	 */
	private createRow(row: SearchIndexDefinition, declaration: ISearchIndexRegistration): SearchIndexDefinition {
		row.entity = declaration.entity;
		row.label = declaration.label;
		row.fields = declaration.fields;
		row.defaultWeight = String(declaration.defaultWeight ?? 1) as any;
		row.titleTemplate = declaration.titleTemplate;
		row.bodyTemplate = declaration.bodyTemplate;
		row.keywordFields = declaration.keywordFields;
		row.sourceUpdatedAtField = declaration.sourceUpdatedAtField ?? 'updatedAt';
		row.isSystem = declaration.isSystem ?? true;
		row.isActive = declaration.isActive ?? true;
		row.version = 1;

		return row;
	}

	/**
	 * Merges a declaration into a row an operator may have tuned.
	 *
	 * The field set is taken from the declaration — the names, their kinds and their source paths —
	 * and every field that already exists keeps the weight and the flags the row holds. Everything
	 * else on the row is left exactly as it is, because everything else on the row is what an operator
	 * owns.
	 *
	 * @param row The row being updated.
	 * @param declaration The declaration.
	 */
	private applyDeclaration(row: SearchIndexDefinition, declaration: ISearchIndexRegistration): void {
		const stored = row.fields ?? [];

		row.fields = (declaration.fields ?? []).map((field) => {
			const existing = stored.find((candidate) => candidate.name === field.name);

			if (!existing) {
				return field;
			}

			return {
				...field,
				weight: existing.weight ?? field.weight,
				searchable: existing.searchable ?? field.searchable,
				filterable: existing.filterable ?? field.filterable,
				facetable: existing.facetable ?? field.facetable
			};
		});

		row.entity = declaration.entity;
		row.isSystem = true;
	}

	/**
	 * The part of a stored row a version bump is about.
	 *
	 * It is the row's shape rather than a declaration's, because the row is what the index is actually
	 * built from: an operator's weight is as much a part of the shape as a developer's field name, and a
	 * comparison against the declaration would report a change on every boot of a tuned installation.
	 *
	 * @param row The row.
	 * @returns The shape.
	 */
	private shapeOfRow(row: SearchIndexDefinition): IDefinitionShape {
		return {
			fields: row.fields ?? [],
			titleTemplate: row.titleTemplate,
			bodyTemplate: row.bodyTemplate,
			keywordFields: row.keywordFields,
			defaultWeight: Number(row.defaultWeight ?? 1),
			sourceUpdatedAtField: row.sourceUpdatedAtField ?? 'updatedAt'
		};
	}

	/**
	 * A stable rendering of a shape, used only to compare two of them.
	 *
	 * Key order is normalised because two objects built from the same declaration in different orders
	 * describe the same index, and a comparison that says otherwise would bump the version — and
	 * invalidate every document — on every boot.
	 *
	 * @param shape The shape.
	 * @returns Its canonical rendering.
	 */
	private serialiseShape(shape: IDefinitionShape): string {
		const normalise = (value: unknown): unknown => {
			if (Array.isArray(value)) {
				return value.map(normalise);
			}

			if (value && typeof value === 'object') {
				return Object.keys(value as Record<string, unknown>)
					.sort()
					.reduce<Record<string, unknown>>((sorted, key) => {
						sorted[key] = normalise((value as Record<string, unknown>)[key]);
						return sorted;
					}, {});
			}

			return value ?? null;
		};

		return JSON.stringify(normalise(shape));
	}
}

/**
 * @param error The failure.
 * @returns A one-line description.
 */
function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
