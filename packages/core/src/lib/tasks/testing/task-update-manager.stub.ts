/**
 * A stand-in for the TypeORM manager `TaskService.update` writes through, for the specs that build the service by
 * hand (`Object.create(TaskService.prototype)`). The update runs its writes in one transaction
 * (`inUpdateTransaction`): `transaction` runs the work at once, on this same manager, and `getRepository` hands out
 * one repository per entity, whose `save` a spec reads with `saves(Entity)` (the sprint move history, the former
 * reference of a moved task). Members of `base` (`findOne`, `find`, …) are kept, and win over these two.
 */
export function stubTaskUpdateManager(base: Record<string, unknown> = {}) {
	const repositories = new Map<unknown, { save: jest.Mock }>();
	const repositoryOf = (entity: unknown) => {
		let repository = repositories.get(entity);
		if (!repository) {
			repository = { save: jest.fn(async (row: unknown) => row) };
			repositories.set(entity, repository);
		}
		return repository;
	};
	const manager: Record<string, unknown> = {
		getRepository: jest.fn((entity: unknown) => repositoryOf(entity)),
		transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => work(manager)),
		...base
	};
	return {
		manager,
		/** The `save` of the repository of `entity` (the same mock on every call). */
		saves: (entity: unknown): jest.Mock => repositoryOf(entity).save
	};
}
