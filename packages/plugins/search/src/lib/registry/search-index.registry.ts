import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ISearchIndexField, ISearchIndexRegistration, SearchFieldKind } from '@gauzy/contracts';

/**
 * The set of field kinds a declaration may use.
 *
 * Read from the contract rather than repeated here, so a kind the platform adds is usable by a
 * declaration without this package changing, and a kind that does not exist is refused instead of
 * producing an index that silently never matches.
 */
const FIELD_KINDS: ReadonlySet<string> = new Set<string>(Object.values(SearchFieldKind));

/**
 * The registry every searchable entity is declared to.
 *
 * A domain makes an entity searchable by registering one declaration: which fields the index holds,
 * where each value is read from, how much it weighs, and which grant a caller needs to see a hit.
 * Nothing about the entity is coded into this package, and adding a searchable entity is a
 * registration rather than an indexer — the same declaration drives indexing, filtering, faceting and
 * ranking for every entity alike.
 *
 * A change to a declaration is a **reindex**, not new code: the fields and the templates decide what a
 * document contains, so editing a weight or adding a field is followed by a rebuild (or by the next
 * sweep, which rebuilds every document whose `definitionVersion` is behind the declaration's). The
 * registry itself holds no state that a restart loses, because the persisted half of a declaration —
 * the weights an operator tuned — lives in `search_index_definition`.
 */
@Injectable()
export class SearchIndexRegistry {
	/** Declarations by entity key. Insertion order is preserved, which is the order listings show. */
	private readonly definitions = new Map<string, ISearchIndexRegistration>();

	private readonly logger = new Logger(SearchIndexRegistry.name);

	constructor(private readonly dataSource: DataSource) {}

	/**
	 * Registers a package's declarations, skipping the ones this installation cannot serve.
	 *
	 * Registration happens here rather than in a constructor because whether a declaration is worth
	 * registering depends on what the live connection maps, and that is a fact about the running
	 * installation rather than about the code: a declaration for a package that is not loaded
	 * describes a class of rows that does not exist.
	 *
	 * It is idempotent, so a package loaded twice — which is what a worker is — registers once, and a
	 * declaration another package has already claimed is left alone rather than throwing. The
	 * difference from {@link registerMany} is deliberate: that method refuses a duplicate because two
	 * declarations for one entity in the same package is a defect, while a second *load* of the same
	 * package is not.
	 *
	 * @param definitions The declarations to register.
	 * @returns The declarations that are registered, in declaration order.
	 */
	registerShipped(definitions: readonly ISearchIndexRegistration[]): ISearchIndexRegistration[] {
		const accepted: ISearchIndexRegistration[] = [];

		for (const definition of definitions ?? []) {
			const entity = String(definition?.entity ?? '').trim();

			if (!this.isMapped(entity)) {
				this.logger.warn(
					`The "${entity}" index declaration is not registered, because no entity in this installation ` +
						'maps its table. The package that owns the entity is not loaded.'
				);

				continue;
			}

			if (!this.definitions.has(entity)) {
				this.register(definition);
			}

			const registered = this.definitions.get(entity);

			if (registered) {
				accepted.push(registered);
			}
		}

		return accepted;
	}

	/**
	 * Whether the live connection maps an entity key.
	 *
	 * The key is a table name, which is what a declaration states and what a search request passes as
	 * its entity filter — so the answer is read from the connection's own metadata rather than from a
	 * list of names kept beside it.
	 *
	 * @param entity The entity key.
	 * @returns True when an entity maps the table.
	 */
	isMapped(entity: string): boolean {
		const key = String(entity ?? '').trim();

		return Boolean(key) && this.dataSource.entityMetadatas.some((metadata) => metadata.tableName === key);
	}

	/**
	 * Registers one declaration.
	 *
	 * Registration is validated eagerly: a declaration that could never produce a usable index is
	 * refused at the point it is written, where the message names the offending field, rather than at
	 * the first query that returns nothing.
	 *
	 * @param definition The declaration.
	 * @throws Error when the declaration is unusable or its entity key is already taken.
	 */
	register(definition: ISearchIndexRegistration): void {
		this.validate(definition);

		const entity = String(definition.entity).trim();

		if (this.definitions.has(entity)) {
			throw new Error(
				`An index definition for "${entity}" is already registered. One entity is declared once; ` +
					'a second declaration for the same entity would silently replace the first one.'
			);
		}

		this.definitions.set(entity, { ...definition, entity });
	}

	/**
	 * Registers several declarations.
	 *
	 * Either every declaration is accepted or none is, so a package that registers a set cannot leave
	 * half of it registered after one entry is refused.
	 *
	 * @param definitions The declarations.
	 * @throws Error when any declaration is unusable or duplicates an entity key.
	 */
	registerMany(definitions: readonly ISearchIndexRegistration[]): void {
		const pending: ISearchIndexRegistration[] = [];
		const seen = new Set<string>();

		for (const definition of definitions ?? []) {
			this.validate(definition);

			const entity = String(definition.entity).trim();

			if (this.definitions.has(entity) || seen.has(entity)) {
				throw new Error(`An index definition for "${entity}" is already registered.`);
			}

			seen.add(entity);
			pending.push({ ...definition, entity });
		}

		for (const definition of pending) {
			this.definitions.set(String(definition.entity), definition);
		}
	}

	/**
	 * The declaration of one entity.
	 *
	 * @param entity The entity key.
	 * @returns The declaration, or `undefined` when the entity is not searchable.
	 */
	get(entity: string): ISearchIndexRegistration | undefined {
		return this.definitions.get(String(entity ?? '').trim());
	}

	/**
	 * Every declaration, in registration order.
	 *
	 * @returns The declarations.
	 */
	getAll(): ISearchIndexRegistration[] {
		return Array.from(this.definitions.values());
	}

	/**
	 * Every registered entity key, in registration order.
	 *
	 * This is the authority on what is searchable. A query service that is tempted to hold a list of
	 * entity types of its own should read this instead: a registered entity that the query service did
	 * not know about is exactly the bug this method exists to prevent.
	 *
	 * @returns The entity keys.
	 */
	registeredEntities(): string[] {
		return Array.from(this.definitions.keys());
	}

	/**
	 * Whether an entity is searchable.
	 *
	 * @param entity The entity key.
	 * @returns True when a declaration is registered for it.
	 */
	has(entity: string): boolean {
		return this.definitions.has(String(entity ?? '').trim());
	}

	/**
	 * The grant a caller needs in order to see a hit of one entity type.
	 *
	 * @param entity The entity key.
	 * @returns The permission value, or `undefined` when the entity is not searchable.
	 */
	permissionFor(entity: string): string | undefined {
		return this.get(entity)?.permission;
	}

	/**
	 * Forgets every declaration.
	 *
	 * For tests only: a suite that registers a fixture declaration must be able to start from a clean
	 * registry without the registrations of whatever ran before it.
	 */
	clear(): void {
		this.definitions.clear();
	}

	/**
	 * Validates one declaration.
	 *
	 * @param definition The declaration to check.
	 * @throws Error naming the first rule the declaration breaks.
	 */
	private validate(definition: ISearchIndexRegistration): void {
		if (!definition || typeof definition !== 'object') {
			throw new Error('An index definition must be an object.');
		}

		const entity = String(definition.entity ?? '').trim();

		if (!entity) {
			throw new Error('An index definition must declare the entity it describes.');
		}

		if (!String(definition.permission ?? '').trim()) {
			throw new Error(
				`The index definition for "${entity}" declares no permission. A hit of an entity type is ` +
					'filtered by the grant the declaration names before it is merged, so a declaration ' +
					'without one would be a declaration nobody can be authorised against.'
			);
		}

		if (!Array.isArray(definition.fields) || definition.fields.length === 0) {
			throw new Error(`The index definition for "${entity}" declares no fields, so it could only index nothing.`);
		}

		const names = new Set<string>();

		for (const field of definition.fields) {
			this.validateField(entity, field, names);
		}

		for (const name of definition.keywordFields ?? []) {
			if (!names.has(name)) {
				throw new Error(
					`The index definition for "${entity}" promotes "${name}" into its keywords, but no field ` +
						'of that name is declared.'
				);
			}
		}
	}

	/**
	 * Validates one declared field.
	 *
	 * @param entity The entity key, for the message.
	 * @param field The field.
	 * @param names The field names already seen in this definition.
	 * @throws Error naming the rule the field breaks.
	 */
	private validateField(entity: string, field: ISearchIndexField, names: Set<string>): void {
		const name = String(field?.name ?? '').trim();

		if (!name) {
			throw new Error(`The index definition for "${entity}" declares a field with no name.`);
		}

		if (names.has(name)) {
			throw new Error(
				`The index definition for "${entity}" declares the field "${name}" twice. A filter, a facet ` +
					'and a sort all address a field by name, so two fields behind one name would be ' +
					'indistinguishable.'
			);
		}

		names.add(name);

		if (!FIELD_KINDS.has(String(field.kind))) {
			throw new Error(
				`The index definition for "${entity}" declares the kind "${field.kind}" for the field ` +
					`"${name}". A kind is one of ${Array.from(FIELD_KINDS).join(', ')}.`
			);
		}

		if (field.weight !== undefined && field.weight !== null) {
			const weight = Number(field.weight);

			if (!Number.isFinite(weight) || weight < 0) {
				throw new Error(
					`The index definition for "${entity}" gives the field "${name}" the weight ` +
						`"${field.weight}". A weight is a non-negative number.`
				);
			}
		}

		if (field.source !== undefined && field.source !== null && !String(field.source).trim()) {
			throw new Error(`The index definition for "${entity}" gives the field "${name}" an empty source path.`);
		}
	}
}
