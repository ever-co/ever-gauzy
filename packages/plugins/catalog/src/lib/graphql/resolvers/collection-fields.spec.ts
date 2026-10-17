/**
 * The `Collection` type answers every field it declares from something the entity has (review R2-22).
 *
 * The type declared `imageAssetId`, `publishedAt` and `channelPublications` while the entity carries `imageId`,
 * `channels` and no publication date of its own, and no field resolver translated between the two — so the three
 * answered null for every collection, and an `imageAssetId` stated on `createCollection` / `updateCollection` was
 * dropped by the ORM, while REST wrote the same column as `imageId`.
 *
 * The suite pins the agreement in both directions: every field of the type is an entity property or has a field
 * resolver, the entity's own names are declared (the old ones stay, deprecated, answering the same values), and
 * the inputs write the image under the entity's name.
 */
import { DocumentNode, FieldDefinitionNode, InputObjectTypeDefinitionNode, Kind, ObjectTypeDefinitionNode } from 'graphql';
import { getMetadataArgsStorage } from 'typeorm';
import { Collection } from '../../collection/collection.entity';
import { schemaExtensions } from '../schema-extensions';
import { CollectionResolver, toCollectionWrite } from './collection.resolver';

const COLLECTION = '00000000-0000-4000-8000-000000000101';
const IMAGE = '00000000-0000-4000-8000-000000000102';

/** The definition of one named type in this plugin's document. */
function definition<T extends ObjectTypeDefinitionNode | InputObjectTypeDefinitionNode>(name: string): T {
	const found = (schemaExtensions as DocumentNode).definitions.find(
		(node) =>
			(node.kind === Kind.OBJECT_TYPE_DEFINITION || node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) &&
			node.name.value === name
	);

	if (!found) {
		throw new Error(`The document declares no ${name}.`);
	}

	return found as T;
}

/** The fields of a type, by name. */
function fields(name: string): Map<string, FieldDefinitionNode> {
	const node = definition<ObjectTypeDefinitionNode>(name);

	return new Map((node.fields ?? []).map((field) => [field.name.value, field]));
}

/** The deprecation reason a field declares, or undefined. */
function deprecation(field: { directives?: readonly any[] } | undefined): string | undefined {
	const directive = field?.directives?.find((it) => it.name.value === 'deprecated');
	const reason = directive?.arguments?.find((it: any) => it.name.value === 'reason');

	return directive ? reason?.value?.value ?? '' : undefined;
}

/** Every property the entity maps — columns, relations, relation ids — on it or on a class it extends. */
function entityProperties(): Set<string> {
	const storage = getMetadataArgsStorage();
	const chain: Function[] = [];

	for (let target: any = Collection; target && target !== Object; target = Object.getPrototypeOf(target)) {
		chain.push(target);
	}

	const owned = (target: unknown) => chain.includes(target as Function);

	return new Set([
		...storage.columns.filter((it) => owned(it.target)).map((it) => it.propertyName),
		...storage.relations.filter((it) => owned(it.target)).map((it) => it.propertyName),
		...storage.relationIds.filter((it) => owned(it.target)).map((it) => it.propertyName)
	]);
}

/** The fields the resolver answers itself, read from `@ResolveField`'s metadata. */
function resolvedFields(): Set<string> {
	const prototype = CollectionResolver.prototype as unknown as Record<string, unknown>;

	return new Set(
		Object.getOwnPropertyNames(prototype)
			.filter((key) => typeof prototype[key] === 'function')
			.filter((key) => Reflect.getMetadata('graphql:resolve_property', prototype[key] as object))
			.map((key) => Reflect.getMetadata('graphql:resolver_name', prototype[key] as object) ?? key)
	);
}

/** A resolver over stubs: the collection service is not reached by the field resolvers. */
function resolverWith(channels: Array<Record<string, unknown>>) {
	const channelService = { findByCollection: jest.fn().mockResolvedValue(channels) };
	const collectionService = { create: jest.fn(async (row) => row), update: jest.fn(async (_id, row) => row) };
	const resolver = new CollectionResolver(collectionService as never, { ofType: () => null } as never, channelService as never);

	return { resolver, channelService, collectionService };
}

describe('Collection type vs the entity (R2-22)', () => {
	it('answers every declared field from an entity property or a field resolver', () => {
		const properties = entityProperties();
		const resolved = resolvedFields();
		const unanswered = [...fields('Collection').keys()].filter((name) => !properties.has(name) && !resolved.has(name));

		expect(unanswered).toEqual([]);
	});

	it('declares the entity’s own names and keeps the earlier ones, deprecated', () => {
		const type = fields('Collection');

		expect(type.has('imageId')).toBe(true);
		expect(type.has('channels')).toBe(true);
		expect(type.has('publishedAt')).toBe(true);
		expect(deprecation(type.get('imageAssetId'))).toMatch(/^Use imageId; removal planned for /);
		expect(deprecation(type.get('channelPublications'))).toMatch(/^Use channels; removal planned for /);
		expect(deprecation(type.get('imageId'))).toBeUndefined();
		expect(deprecation(type.get('channels'))).toBeUndefined();
	});

	it.each(['CreateCollectionInput', 'UpdateCollectionInput'])('%s writes the image as imageId', (name) => {
		const input = new Map(
			(definition<InputObjectTypeDefinitionNode>(name).fields ?? []).map((field) => [field.name.value, field])
		);

		expect(input.has('imageId')).toBe(true);
		expect(deprecation(input.get('imageAssetId'))).toMatch(/^Use imageId; removal planned for /);
	});

	it('resolves imageAssetId from the imageId column', () => {
		const { resolver } = resolverWith([]);

		expect(resolver.imageAssetId({ id: COLLECTION, imageId: IMAGE } as Collection)).toBe(IMAGE);
		expect(resolver.imageAssetId({ id: COLLECTION } as Collection)).toBeNull();
	});

	it('answers channels and channelPublications with the same rows, read once per collection', async () => {
		const rows = [{ id: 'cc1', collectionId: COLLECTION, channelId: 'ch1' }];
		const { resolver, channelService } = resolverWith(rows);
		const parent = { id: COLLECTION } as Collection;

		await expect(resolver.channels(parent)).resolves.toEqual(rows);
		await expect(resolver.channelPublications(parent)).resolves.toEqual(rows);
		expect(channelService.findByCollection).toHaveBeenCalledTimes(1);
		expect(channelService.findByCollection).toHaveBeenCalledWith(COLLECTION);
	});

	it('answers a loaded channels relation without reading again', async () => {
		const rows = [{ id: 'cc1' }] as never[];
		const { resolver, channelService } = resolverWith([]);

		await expect(resolver.channels({ id: COLLECTION, channels: rows } as Collection)).resolves.toBe(rows);
		expect(channelService.findByCollection).not.toHaveBeenCalled();
	});

	it('answers publishedAt with the earliest channel publication instant, null when never published', async () => {
		const early = new Date('2026-01-02T03:04:05.000Z');
		const late = new Date('2026-05-06T07:08:09.000Z');

		await expect(
			resolverWith([{ publishedAt: late }, { publishedAt: null }, { publishedAt: early }]).resolver.publishedAt({
				id: COLLECTION
			} as Collection)
		).resolves.toEqual(early);
		await expect(
			resolverWith([{ publishedAt: null }]).resolver.publishedAt({ id: COLLECTION } as Collection)
		).resolves.toBeNull();
	});

	it('writes an imageAssetId stated on createCollection / updateCollection to imageId', async () => {
		const { resolver, collectionService } = resolverWith([]);

		await resolver.createCollection({ name: 'Shelf', slug: 'shelf', imageAssetId: IMAGE });
		await resolver.updateCollection(COLLECTION, { imageAssetId: null });

		expect(collectionService.create).toHaveBeenCalledWith({ name: 'Shelf', slug: 'shelf', imageId: IMAGE });
		expect(collectionService.update).toHaveBeenCalledWith(COLLECTION, { imageId: null });
	});

	it('keeps imageId when both names are stated, and leaves an input without either alone', () => {
		expect(toCollectionWrite({ imageId: IMAGE, imageAssetId: 'other' })).toEqual({ imageId: IMAGE });
		expect(toCollectionWrite({ name: 'Shelf' })).toEqual({ name: 'Shelf' });
		expect(toCollectionWrite(undefined)).toEqual({});
	});
});
