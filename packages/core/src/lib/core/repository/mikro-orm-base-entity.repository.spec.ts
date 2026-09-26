import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Entity, PrimaryKey } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/knex';
import { MikroOrmBaseEntityRepository, resolveMikroOrmRepositoryEntity } from './mikro-orm-base-entity.repository';

/**
 * A `MikroOrm*Repository` listed in a module's `providers` is built by Nest, not by MikroORM.
 *
 * It used to be built with no arguments — the base declared no injectable constructor — so `em` and
 * `entityName` were `undefined` and every call failed under `DB_ORM=mikro-orm` (`reading 'findOne'`,
 * `reading 'transactional'`): nobody could sign in. These cases build the repositories the way Nest does.
 */

class MikroOrmSpecLinkedRepository extends MikroOrmBaseEntityRepository<SpecLinked> {}

@Entity({ tableName: 'spec_linked', repository: () => MikroOrmSpecLinkedRepository })
class SpecLinked {
	@PrimaryKey()
	id!: string;
}

/** Not named by its entity's decorator: resolved by the `MikroOrm<Entity>Repository` convention. */
class MikroOrmSpecConventionalRepository extends MikroOrmBaseEntityRepository<SpecConventional> {}

@Entity({ tableName: 'spec_conventional' })
class SpecConventional {
	@PrimaryKey()
	id!: string;
}

class MikroOrmNothingHereRepository extends MikroOrmBaseEntityRepository<object> {}

/** Stands in for the application's global EntityManager, under the class token Nest injects. */
const fakeEntityManager = { findOne: jest.fn(async () => ({ id: 'row' })) } as unknown as EntityManager;

async function buildWithNest<R>(repository: new (...args: any[]) => R, withEntityManager = true): Promise<R> {
	const moduleRef = await Test.createTestingModule({
		providers: [...(withEntityManager ? [{ provide: EntityManager, useValue: fakeEntityManager }] : []), repository]
	}).compile();

	return moduleRef.get(repository);
}

describe('MikroOrmBaseEntityRepository', () => {
	it('is given the application EntityManager when Nest builds it, and serves the entity that names it', async () => {
		const repository = await buildWithNest(MikroOrmSpecLinkedRepository);

		expect(repository.getEntityManager()).toBe(fakeEntityManager);
		expect(repository.getEntityName()).toBe('SpecLinked');

		await expect(repository.findOne({ id: 'row' })).resolves.toEqual({ id: 'row' });
		expect((fakeEntityManager as any).findOne).toHaveBeenCalledWith(SpecLinked, { id: 'row' }, undefined);
	});

	it('resolves an entity that does not name its repository by the MikroOrm<Entity>Repository convention', async () => {
		const repository = await buildWithNest(MikroOrmSpecConventionalRepository);

		expect(repository.getEntityName()).toBe('SpecConventional');
		expect(resolveMikroOrmRepositoryEntity(MikroOrmSpecConventionalRepository)).toBe(SpecConventional);
	});

	it('names the repository when it serves no entity, on first use rather than at construction', async () => {
		const repository = await buildWithNest(MikroOrmNothingHereRepository);

		expect(() => repository.getEntityName()).toThrow(
			/MikroOrmNothingHereRepository serves no MikroORM entity: link it with .*mikroOrmRepository/
		);
	});

	it('is still built, as before, by a module without MikroORM', async () => {
		const repository = await buildWithNest(MikroOrmSpecLinkedRepository, false);

		expect(repository.getEntityManager()).toBeUndefined();
	});

	it('keeps what MikroORM passes when it builds the repository itself', () => {
		const other = {} as EntityManager;
		const repository = new MikroOrmSpecLinkedRepository(other, SpecConventional as any);

		expect(repository.getEntityManager()).toBe(other);
		expect(repository.getEntityName()).toBe('SpecConventional');
	});
});
