import { BadRequestException } from '@nestjs/common';
import { And, Equal, FindOperator, In, IsNull, Not } from 'typeorm';
import { BaseEntityEnum } from '@gauzy/contracts';
import { convertTypeORMWhereToMikroORM } from '../../core/utils';
import { scopeCommentReadToParents } from './scope-comment-read';

const CONTACT = BaseEntityEnum.OrganizationContact;
const PROJECT = BaseEntityEnum.OrganizationProject;
const GOVERNED = [CONTACT];
const CONTACT_ID = '6d7c4a3e-1b2f-4c5d-8e9f-0a1b2c3d4e5f';
const PROJECT_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';

const outside = () => Not(In([CONTACT]));

describe('scopeCommentReadToParents', () => {
	it('returns the criteria untouched when no record type is governed', () => {
		const where = { entity: PROJECT, entityId: PROJECT_ID };

		expect(scopeCommentReadToParents(where, [])).toEqual({ where, parents: [], onlyGovernedParents: false });
		expect(scopeCommentReadToParents(undefined, []).where).toBeUndefined();
	});

	it('keeps a read of one governed record as it is, and names the record to check', () => {
		const where = { entity: CONTACT, entityId: CONTACT_ID, organizationId: 'org-1' };

		const scope = scopeCommentReadToParents(where, GOVERNED);

		expect(scope.where).toBe(where);
		expect(scope.parents).toEqual([{ entity: CONTACT, entityId: CONTACT_ID }]);
		expect(scope.onlyGovernedParents).toBe(true);
	});

	it('narrows a read of another record type to non-governed comments, which is always true for it', () => {
		const where = { entity: PROJECT, entityId: PROJECT_ID };

		const scope = scopeCommentReadToParents(where, GOVERNED);

		expect(scope.where).toEqual({ entity: And(Equal(PROJECT), outside()), entityId: PROJECT_ID });
		expect(scope.parents).toEqual([]);
		expect(scope.onlyGovernedParents).toBe(false);
	});

	it.each([
		['no criteria at all', undefined],
		['null criteria', null],
		['empty criteria', {}],
		['an empty list, which the CRUD base reads as no criteria', []]
	])('leaves the comments of governed records out of %s', (_label, where) => {
		const scope = scopeCommentReadToParents(where as object, GOVERNED);

		expect(Array.isArray(where) ? scope.where : [scope.where]).toEqual([{ entity: outside() }]);
		expect(scope.onlyGovernedParents).toBe(false);
	});

	it('leaves them out of a read that names no record type but another column', () => {
		const scope = scopeCommentReadToParents({ parentId: CONTACT_ID }, GOVERNED);

		expect(scope.where).toEqual({ parentId: CONTACT_ID, entity: outside() });
	});

	it('states the exclusion beside a spelling the database may still match to a governed type', () => {
		// MySQL compares with a case-, accent- and trailing-space-insensitive collation.
		for (const spelling of ['organizationcontact', 'OrganizationContact ', 'ORGANIZATIONCONTACT']) {
			const scope = scopeCommentReadToParents({ entity: spelling, entityId: CONTACT_ID }, GOVERNED);

			expect(scope.where).toEqual({ entity: And(Equal(spelling), outside()), entityId: CONTACT_ID });
			expect(scope.parents).toEqual([]);
		}
	});

	it('checks another spelling as the governed record’s read when the matcher says it names that type', () => {
		const typeOf = (entity: string) => (entity.toLowerCase() === CONTACT.toLowerCase() ? CONTACT : undefined);
		const where = { entity: 'organizationcontact', entityId: CONTACT_ID };

		const scope = scopeCommentReadToParents(where, GOVERNED, typeOf);

		expect(scope.where).toBe(where);
		expect(scope.parents).toEqual([{ entity: CONTACT, entityId: CONTACT_ID }]);
		expect(scope.onlyGovernedParents).toBe(true);
		expect(() => scopeCommentReadToParents({ entity: 'organizationcontact' }, GOVERNED, typeOf)).toThrow(
			BadRequestException
		);
	});

	it('keeps a find operator on the type and adds the exclusion beside it', () => {
		const stated = In([PROJECT, CONTACT]);

		const scope = scopeCommentReadToParents({ entity: stated }, GOVERNED);

		expect(scope.where).toEqual({ entity: And(stated, outside()) });
		expect((scope.where as { entity: FindOperator<string> }).entity).toBeInstanceOf(FindOperator);
	});

	it('keeps a stated null type alone, so that the MikroORM translation keeps it', () => {
		const scope = scopeCommentReadToParents({ entity: IsNull(), entityId: PROJECT_ID }, GOVERNED);

		expect(scope.where).toEqual({ entity: IsNull(), entityId: PROJECT_ID });
		expect(convertTypeORMWhereToMikroORM(scope.where as any)).toEqual({ entity: null, entityId: PROJECT_ID });
	});

	it('states the exclusion so that the MikroORM translation keeps it beside the stated type', () => {
		const scope = scopeCommentReadToParents({ entity: PROJECT, entityId: PROJECT_ID }, GOVERNED);

		expect(convertTypeORMWhereToMikroORM(scope.where as any)).toEqual({
			entity: { $eq: PROJECT },
			entityId: PROJECT_ID,
			$and: [{ $not: { entity: { $in: [CONTACT] } } }]
		});
	});

	it('scopes each alternative of a list on its own', () => {
		const where = [
			{ entity: CONTACT, entityId: CONTACT_ID },
			{ entity: PROJECT, entityId: PROJECT_ID }
		];

		const scope = scopeCommentReadToParents(where, GOVERNED);

		expect(scope.where).toEqual([
			{ entity: CONTACT, entityId: CONTACT_ID },
			{ entity: And(Equal(PROJECT), outside()), entityId: PROJECT_ID }
		]);
		expect(scope.parents).toEqual([{ entity: CONTACT, entityId: CONTACT_ID }]);
		expect(scope.onlyGovernedParents).toBe(false);
	});

	it('names each governed record once, and says when every alternative names one', () => {
		const where = [
			{ entity: CONTACT, entityId: CONTACT_ID },
			{ entity: CONTACT, entityId: CONTACT_ID, parentId: PROJECT_ID }
		];

		const scope = scopeCommentReadToParents(where, GOVERNED);

		expect(scope.parents).toEqual([{ entity: CONTACT, entityId: CONTACT_ID }]);
		expect(scope.onlyGovernedParents).toBe(true);
	});

	it.each([
		['without a record id', { entity: CONTACT }],
		['with an id that is not one', { entity: CONTACT, entityId: 'not-a-uuid' }],
		['with a list of ids', { entity: CONTACT, entityId: In([CONTACT_ID]) }]
	])('refuses a read of a governed type %s', (_label, where) => {
		expect(() => scopeCommentReadToParents(where as object, GOVERNED)).toThrow(BadRequestException);
	});

	it.each([
		['text criteria', 'entity=OrganizationContact'],
		['a list holding text', ['entity']],
		['a type stated as an object', { entity: { $ne: PROJECT } }],
		['a type stated as a list', { entity: [PROJECT, CONTACT] }]
	])('refuses %s, which it cannot keep to the policies', (_label, where) => {
		expect(() => scopeCommentReadToParents(where as object, GOVERNED)).toThrow(BadRequestException);
	});
});
