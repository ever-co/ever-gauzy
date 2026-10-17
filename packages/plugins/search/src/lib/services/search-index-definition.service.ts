import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { FindOptionsWhere, IsNull } from 'typeorm';
import { ID, ISearchIndexField, ISearchIndexRegistration, JsonData, SearchFieldKind } from '@gauzy/contracts';
import {
	CrudService,
	MikroOrmSearchIndexDefinitionRepository,
	RequestContext,
	SearchIndexDefinition,
	TypeOrmSearchIndexDefinitionRepository,
	isUniqueViolation
} from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { SEARCH_INDEX_DEFINITIONS } from '../definitions';

/** What an operator may change on a definition. */
interface IDefinitionChanges {
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

/** The fields of a declaration an operator may change, and which bump the version when they do. */
interface IDefinitionShape {
	fields: ISearchIndexField[];
	titleTemplate?: string;
	bodyTemplate?: string;
	keywordFields?: string[];
	defaultWeight: number;
	sourceUpdatedAtField: string;
}

/** The kinds a field may declare — the registry's own list (`registry/search-index.registry.ts`). */
const FIELD_KINDS: ReadonlySet<string> = new Set<string>(Object.values(SearchFieldKind));

/**
 * Refuses a text member longer than the REST contract allows.
 *
 * @param value The member, when stated.
 * @param max Its longest form.
 * @param what How the refusal names it.
 * @throws BadRequestException When it is longer.
 */
function assertMaxLength(value: unknown, max: number, what: string): void {
	if (value !== undefined && value !== null && String(value).length > max) {
		throw new BadRequestException(`An index definition's ${what} is at most ${max} characters.`);
	}
}

/** A field name's longest form, as `SearchIndexFieldDTO.name` caps it on REST. */
const MAX_FIELD_NAME_LENGTH = 128;

/** A field source path's longest form, as `SearchIndexFieldDTO.source` caps it on REST. */
const MAX_FIELD_SOURCE_LENGTH = 255;

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

			updated += await this.reconcileOrganizationCopies(declaration, existing);
		}

		if (created > 0 || updated > 0) {
			this.logger.log(`The search index definitions are synchronised: ${created} created, ${updated} updated.`);
		}

		return { created, updated };
	}

	/**
	 * Carries a declaration's field set into the organizations' own copies of its platform row.
	 *
	 * A copy (`updateDefinition`) is the definition `findFor` answers for its organization, so a field set it stopped
	 * following would keep that organization on an index the code no longer declares — a field added in code never
	 * indexed there, one removed still read (CodeRabbit). The same merge as the platform row's applies: the code owns
	 * the field set, the copy keeps every weight, flag, template and switch its organization tuned, and its version is
	 * bumped when its effective shape changed, so the next sweep rebuilds that organization's documents. A copy stays
	 * the organization's own (`isSystem` false): deleting it still falls back to the shipped row.
	 *
	 * @param declaration The declaration.
	 * @param platform The platform row just synchronised, which is not a copy.
	 * @returns How many copies changed.
	 */
	private async reconcileOrganizationCopies(
		declaration: ISearchIndexRegistration,
		platform: SearchIndexDefinition
	): Promise<number> {
		const repository = this.typeOrmSearchIndexDefinitionRepository;
		const copies = (await repository.find({ where: { entity: declaration.entity } as any })).filter(
			(row) => !!row.organizationId && row.id !== platform.id
		);
		let changed = 0;

		for (const copy of copies) {
			const before = this.serialiseShape(this.shapeOfRow(copy));

			copy.fields = this.mergeDeclaredFields(copy.fields, declaration);

			if (this.serialiseShape(this.shapeOfRow(copy)) === before) {
				continue;
			}

			copy.version = Math.max(1, Number(copy.version) || 1) + 1;
			await repository.save(copy);
			changed += 1;
		}

		return changed;
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
	 * The organizations' own definitions of one entity that are switched off.
	 *
	 * A sweep reads the source rows of every organization in its tenant, so it is the one place an organization that
	 * switched its own copy off (SEC-B-04) has to be named: its documents are not another organization's to rebuild.
	 *
	 * @param entity The entity key.
	 * @param tenantId The tenant whose copies are read; every tenant's when none is named (a system sweep).
	 * @returns The switched-off copies, each naming its tenant and organization.
	 */
	async inactiveOrganizationCopies(entity: string, tenantId?: ID | null): Promise<SearchIndexDefinition[]> {
		const rows = await this.typeOrmSearchIndexDefinitionRepository.find({
			where: { entity, isActive: false, ...(tenantId ? { tenantId } : {}) } as any
		});

		return rows.filter((row) => !!row.organizationId);
	}

	/**
	 * The shipped (platform) definition of one entity, whatever organization the caller has selected.
	 *
	 * A sweep is the tenant's, not the caller's organization's: it reads every organization's rows and writes each one
	 * under its own organization's definition (Q16). Resolving the sweep's definition through `findFor` stamped the
	 * whole tenant with the version — and the switch — of whichever organization the operator happened to have
	 * selected.
	 *
	 * @param entity The entity key.
	 * @returns The platform row, or `null` when the entity has no persisted definition.
	 */
	async platformDefinitionOf(entity: string): Promise<SearchIndexDefinition | null> {
		return await this.typeOrmSearchIndexDefinitionRepository.findOne({
			where: { entity, organizationId: IsNull() } as any
		});
	}

	/**
	 * Every organization's own definition of one entity, switched on or off.
	 *
	 * @param entity The entity key.
	 * @param tenantId The tenant whose copies are read; every tenant's when none is named (a system sweep).
	 * @returns The copies, each naming its tenant and organization.
	 */
	async organizationCopies(entity: string, tenantId?: ID | null): Promise<SearchIndexDefinition[]> {
		const rows = await this.typeOrmSearchIndexDefinitionRepository.find({
			where: { entity, ...(tenantId ? { tenantId } : {}) } as any
		});

		return rows.filter((row) => !!row.organizationId);
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
	async updateDefinition(id: ID, changes: IDefinitionChanges): Promise<SearchIndexDefinition> {
		// A shipped (platform) row is every tenant's: a change to it lands on a copy scoped to the caller's tenant and
		// organization, which `findFor` prefers for that organization (SEC-B-04). The platform row is never saved from
		// a request — switched off or re-weighted in place, it changed every other tenant's index.
		const found = await this.findOneScoped(id);

		if (found.tenantId) {
			return await this.saveChanges(found, changes);
		}

		const copy = await this.organizationCopyOf(found);
		const first = !copy.id;

		try {
			return await this.saveChanges(copy, changes);
		} catch (error) {
			// Two first changes of one organization both found no copy, and the unique index let one of them in
			// (Greptile). This change is applied to the copy that won rather than refused with the database's error.
			if (!first || !isUniqueViolation(error)) {
				throw error;
			}

			const winner = await this.organizationCopyOf(found);

			if (!winner.id) {
				throw error;
			}

			return await this.saveChanges(winner, changes);
		}
	}

	/**
	 * Applies an operator's change to a tenant's row and saves it.
	 *
	 * @param row The row: an organization's own, never a platform row.
	 * @param changes The fields to change.
	 * @returns The saved row.
	 */
	private async saveChanges(row: SearchIndexDefinition, changes: IDefinitionChanges): Promise<SearchIndexDefinition> {
		const shapeBefore = this.serialiseShape(this.shapeOfRow(row));

		// The caps `UpdateSearchIndexDefinitionDTO` puts on REST, applied to GraphQL too (R2-G5).
		assertMaxLength(changes.label, 255, 'label');
		assertMaxLength(changes.titleTemplate, 512, 'title template');
		assertMaxLength(changes.bodyTemplate, 1024, 'body template');
		assertMaxLength(changes.sourceUpdatedAtField, 64, 'source timestamp field');

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

		if (!row.tenantId) {
			throw new BadRequestException('A shipped search index definition is never changed in place; it is changed for one organization.');
		}

		return await this.typeOrmSearchIndexDefinitionRepository.save(row);
	}

	/**
	 * The caller's organization's own copy of a platform definition: the one it already has, or a new one carrying
	 * the platform row's shape and version, which the change is then applied to.
	 *
	 * @param platform The platform row.
	 * @returns The organization's row, saved or not yet saved.
	 * @throws BadRequestException when the request names no tenant or organization to scope the copy to.
	 */
	private async organizationCopyOf(platform: SearchIndexDefinition): Promise<SearchIndexDefinition> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		if (!tenantId || !organizationId) {
			throw new BadRequestException(
				`The "${platform.entity}" index definition is shipped for every organization; select an organization to change it for.`
			);
		}

		const existing = await this.typeOrmSearchIndexDefinitionRepository.findOne({
			where: { entity: platform.entity, tenantId, organizationId } as any
		});

		if (existing) {
			return existing;
		}

		return Object.assign(this.typeOrmSearchIndexDefinitionRepository.create(), {
			entity: platform.entity,
			label: platform.label,
			engineKey: platform.engineKey,
			fields: JSON.parse(JSON.stringify(platform.fields ?? [])),
			defaultWeight: platform.defaultWeight,
			titleTemplate: platform.titleTemplate,
			bodyTemplate: platform.bodyTemplate,
			keywordFields: platform.keywordFields ? [...platform.keywordFields] : platform.keywordFields,
			sourceUpdatedAtField: platform.sourceUpdatedAtField,
			metadata: platform.metadata,
			isActive: platform.isActive,
			// The copy is the organization's own: deleting it falls back to the shipped definition.
			isSystem: false,
			// Documents built at the platform version are current for the copy until its shape changes.
			version: platform.version,
			tenantId,
			organizationId
		}) as SearchIndexDefinition;
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
	 * It is also the one place both doors meet (review sweep R2-G5): `PUT /search/index-definitions/:id`
	 * validated a field's weight (`@Min(0)`) and its lengths but took any `kind` string, while
	 * `updateSearchIndexDefinition` checked the kind (an SDL enum) but stored a negative weight — which the
	 * document builder then silently ignored — and any length. Kind, weight, source and the name/source
	 * lengths are now checked here, for both.
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

			if (name.length > MAX_FIELD_NAME_LENGTH) {
				throw new BadRequestException(
					`The index definition for "${entity}" declares a field name longer than ${MAX_FIELD_NAME_LENGTH} characters.`
				);
			}

			if (!FIELD_KINDS.has(String(field.kind))) {
				throw new BadRequestException(
					`The index definition for "${entity}" declares the kind "${field.kind}" for the field ` +
						`"${name}". A kind is one of ${Array.from(FIELD_KINDS).join(', ')}.`
				);
			}

			if (field.weight !== undefined && field.weight !== null) {
				const weight = Number(field.weight);

				if (!Number.isFinite(weight) || weight < 0) {
					throw new BadRequestException(
						`The index definition for "${entity}" gives the field "${name}" the weight ` +
							`"${field.weight}". A weight is a non-negative number.`
					);
				}
			}

			if (field.source !== undefined && field.source !== null) {
				const source = String(field.source);

				if (!source.trim()) {
					throw new BadRequestException(
						`The index definition for "${entity}" gives the field "${name}" an empty source path.`
					);
				}

				if (source.length > MAX_FIELD_SOURCE_LENGTH) {
					throw new BadRequestException(
						`The index definition for "${entity}" gives the field "${name}" a source path longer than ` +
							`${MAX_FIELD_SOURCE_LENGTH} characters.`
					);
				}
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
		row.fields = this.mergeDeclaredFields(row.fields, declaration);
		row.entity = declaration.entity;
		row.isSystem = true;
	}

	/**
	 * The declaration's field set, each field keeping the weight and the flags a row already holds for it.
	 *
	 * @param stored The fields the row holds.
	 * @param declaration The declaration.
	 * @returns The merged fields.
	 */
	private mergeDeclaredFields(
		stored: ISearchIndexField[] | null | undefined,
		declaration: ISearchIndexRegistration
	): ISearchIndexField[] {
		return (declaration.fields ?? []).map((field) => {
			const existing = (stored ?? []).find((candidate) => candidate.name === field.name);

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
