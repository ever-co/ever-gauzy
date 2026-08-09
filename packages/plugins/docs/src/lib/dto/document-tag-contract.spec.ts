/**
 * The `tags` / `tagIds` contract between `@gauzy/contracts` and the document request DTOs.
 *
 * `IDocumentCreateInput` publishes `tags?: ITag[]`, but the create DTO declared only
 * `tagIds?: ID[]` — and `POST /documents` / `PUT /documents/:id` validate with
 * `forbidNonWhitelisted: true`. A caller typed against the published interface therefore got a
 * 400 naming a property its own interface had told it to send, with nothing to act on. Nothing
 * sent `tags` yet, so this was latent rather than live; these tests keep it that way.
 *
 * The DTO now accepts both shapes and `resolveTagIds` folds them into the id list the entity
 * relation is built from. Nothing was removed from the contracts package.
 *
 * `@gauzy/core` boots the whole application graph on import, so its DTO base is stubbed with a
 * plain class here (same approach as `document-dto-surface.spec.ts`).
 */
jest.mock(
	'@gauzy/core',
	() => {
		const { IsOptional, IsUUID } = jest.requireActual('class-validator');
		class TenantOrganizationBaseDTO {
			organizationId?: string;
		}
		IsOptional()(TenantOrganizationBaseDTO.prototype, 'organizationId');
		IsUUID()(TenantOrganizationBaseDTO.prototype, 'organizationId');
		return { TenantOrganizationBaseDTO, BaseQueryDTO: class {} };
	},
	{ virtual: true }
);

import { plainToInstance } from 'class-transformer';
import { getMetadataStorage, validate } from 'class-validator';
import { DocumentKindEnum } from '@gauzy/contracts';
import { CreateDocumentDTO } from './create-document.dto';
import { resolveTagIds } from './document-tag-reference';
import { UpdateDocumentDTO } from './update-document.dto';

const TAG_A = '11111111-1111-4111-8111-111111111111';
const TAG_B = '22222222-2222-4222-8222-222222222222';

/** Exactly the pipe configuration `document.controller.ts` puts on create and update. */
const ROUTE_VALIDATION = { whitelist: true, forbidNonWhitelisted: true };

/** Runs a plain create payload through transform + validation, as the route does. */
const validateCreate = async (payload: Record<string, unknown>) => {
	const instance = plainToInstance(CreateDocumentDTO, {
		kind: DocumentKindEnum.PAGE,
		name: 'Runbook',
		...payload
	});
	return validate(instance as object, ROUTE_VALIDATION);
};

/** Every property class-validator knows about for a DTO, inherited members included. */
const validatedPropertiesOf = (target: any): string[] => [
	...new Set(
		getMetadataStorage()
			.getTargetValidationMetadatas(target, '', true, false)
			.map((metadata: any) => metadata.propertyName)
	)
];

describe('CreateDocumentDTO — accepts the shape the contracts interface publishes', () => {
	it('accepts `tagIds` (the shape every current caller sends)', async () => {
		expect(await validateCreate({ tagIds: [TAG_A, TAG_B] })).toEqual([]);
	});

	it('accepts `tags` — the `IDocumentCreateInput` shape — instead of a 400', async () => {
		expect(await validateCreate({ tags: [{ id: TAG_A }, { id: TAG_B }] })).toEqual([]);
	});

	it('accepts a full ITag object, not just an `{ id }` stub', async () => {
		// A caller that echoes back a tag it fetched from `/tags` must not be rejected for the
		// extra fields: `tags` is validated, but never treated as a nested whitelisted DTO.
		const errors = await validateCreate({
			tags: [{ id: TAG_A, name: 'Runbooks', color: '#fff', isActive: true, tenantId: TAG_B }]
		});

		expect(errors).toEqual([]);
	});

	it('accepts both shapes together', async () => {
		expect(await validateCreate({ tagIds: [TAG_A], tags: [{ id: TAG_B }] })).toEqual([]);
	});

	it('rejects a tag without an id — a document write never creates a tag', async () => {
		const errors = await validateCreate({ tags: [{ name: 'Brand new tag', color: '#fff' }] });

		expect(errors).toHaveLength(1);
		expect(errors[0].property).toBe('tags');
		expect(Object.values(errors[0].constraints ?? {}).join(' ')).toContain('id');
	});

	it('rejects a tag whose id is not a UUID', async () => {
		const errors = await validateCreate({ tags: [{ id: 'not-a-uuid' }] });

		expect(errors.map((error) => error.property)).toEqual(['tags']);
	});

	it.each([[['plain-string']], [[null]], [[42]]])('rejects a non-object entry (%p)', async (tags) => {
		const errors = await validateCreate({ tags });

		expect(errors.map((error) => error.property)).toEqual(['tags']);
	});

	it('still rejects a genuinely unknown property — the whitelist was not loosened', async () => {
		const errors = await validateCreate({ tagz: [TAG_A] });

		expect(errors.map((error) => error.property)).toContain('tagz');
	});

	it('carries `tags` through to the update DTO (PUT /documents/:id speaks the same contract)', () => {
		expect(validatedPropertiesOf(UpdateDocumentDTO)).toEqual(expect.arrayContaining(['tags', 'tagIds']));
	});

	it('validates `tags` on the update DTO too — the inherited metadata is live, not just present', async () => {
		const accepted = plainToInstance(UpdateDocumentDTO, { tags: [{ id: TAG_A }] });
		const rejected = plainToInstance(UpdateDocumentDTO, { tags: [{ name: 'Brand new tag' }] });

		expect(await validate(accepted as object, ROUTE_VALIDATION)).toEqual([]);
		expect((await validate(rejected as object, ROUTE_VALIDATION)).map((error) => error.property)).toEqual([
			'tags'
		]);
	});
});

describe('resolveTagIds — one operation, either shape', () => {
	it('leaves the relation alone when neither field is present', () => {
		expect(resolveTagIds({})).toBeUndefined();
		expect(resolveTagIds(undefined)).toBeUndefined();
	});

	it('passes `tagIds` through unchanged', () => {
		expect(resolveTagIds({ tagIds: [TAG_A, TAG_B] })).toEqual([TAG_A, TAG_B]);
	});

	it('normalizes `tags` references to their ids', () => {
		expect(resolveTagIds({ tags: [{ id: TAG_A }, { id: TAG_B }] as any })).toEqual([TAG_A, TAG_B]);
	});

	it('unions the mixed case, de-duplicated and order-stable', () => {
		expect(resolveTagIds({ tagIds: [TAG_A], tags: [{ id: TAG_A }, { id: TAG_B }] as any })).toEqual([
			TAG_A,
			TAG_B
		]);
	});

	it('treats an explicitly empty array as "clear the tags", in either shape', () => {
		expect(resolveTagIds({ tagIds: [] })).toEqual([]);
		expect(resolveTagIds({ tags: [] })).toEqual([]);
	});

	it('ignores an id-less reference rather than inventing a tag (validation already rejected it)', () => {
		expect(resolveTagIds({ tags: [{ name: 'Brand new tag' }] as any })).toEqual([]);
	});
});
