import '../../../core/entities/internal';

import { ValidationArguments } from 'class-validator';

/**
 * `ormType` is read when the constraint module loads, so each ORM gets a fresh copy of the module
 * (and of the RequestContext it uses) loaded with the matching DB_ORM.
 */
function loadConstraint(orm: 'typeorm' | 'mikro-orm') {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = orm;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let modules: any;
	jest.isolateModules(() => {
		modules = {
			context: require('../../../core/context'),
			constraint: require('./expense-category-already-exist.constraint')
		};
	});
	process.env.DB_ORM = previous;
	jest.spyOn(modules.context.RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
	return modules.constraint.ExpenseCategoryAlreadyExistConstraint;
}

const args = (object: object, targetName = 'CreateExpenseCategoryDTO') =>
	({ object, targetName }) as unknown as ValidationArguments;

describe('ExpenseCategoryAlreadyExistConstraint', () => {
	afterEach(() => jest.restoreAllMocks());

	describe('MikroORM', () => {
		it('rejects a name that exists with another case', async () => {
			const find = jest.fn().mockResolvedValue([{ id: 'c-1', name: 'Travel' }]);
			const Constraint = loadConstraint('mikro-orm');
			const constraint = new Constraint({}, { find });

			await expect(constraint.validate('travel', args({ organizationId: 'org-1' }))).resolves.toBe(false);
		});

		it('accepts a name whose LIKE wildcards only match a different name', async () => {
			// "Food_100%" as a LIKE pattern matches "FoodX100Y"; that is not a duplicate
			const find = jest.fn().mockResolvedValue([{ id: 'c-1', name: 'FoodX100Y' }]);
			const Constraint = loadConstraint('mikro-orm');
			const constraint = new Constraint({}, { find });

			await expect(constraint.validate('Food_100%', args({ organizationId: 'org-1' }))).resolves.toBe(true);
		});

		it('excludes the category being updated with a MikroORM operator', async () => {
			const find = jest.fn().mockResolvedValue([]);
			const Constraint = loadConstraint('mikro-orm');
			const constraint = new Constraint({}, { find });

			await constraint.validate('Travel', args({ organizationId: 'org-1', id: 'c-1' }, 'UpdateExpenseCategoryDTO'));

			expect(find).toHaveBeenCalledWith(
				expect.objectContaining({ organizationId: 'org-1', tenantId: 'tenant-1', id: { $ne: 'c-1' } })
			);
		});
	});

	describe('TypeORM', () => {
		it('rejects an existing name and accepts a wildcard-only match', async () => {
			const Constraint = loadConstraint('typeorm');

			const existing = new Constraint({ findBy: jest.fn().mockResolvedValue([{ name: 'Travel' }]) }, {});
			await expect(existing.validate('TRAVEL', args({ organizationId: 'org-1' }))).resolves.toBe(false);

			const wildcard = new Constraint({ findBy: jest.fn().mockResolvedValue([{ name: 'FoodX100Y' }]) }, {});
			await expect(wildcard.validate('Food_100%', args({ organizationId: 'org-1' }))).resolves.toBe(true);
		});
	});
});
