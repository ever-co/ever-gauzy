import 'reflect-metadata';
import { AccountDeletionRequest } from '../../account-deletion/account-deletion-request.entity';
import { SkipExport } from '../skip-export.decorator';
import { IRepositoryModel, RepositoriesService } from './repositories.service';

/**
 * `SkipExport` was honored only for plugin entities (`createDynamicInstanceForPluginEntities`): a core entity
 * carrying it was still exported and imported as soon as `registerCoreRepositories()` listed its repository.
 */
describe('RepositoriesService.buildRepositoriesRelationsGraph', () => {
	@SkipExport()
	class SkippedEntity {}
	class ExportedEntity {}

	const repositoryOf = (target: Function) => ({ metadata: { target, tableName: target.name } }) as any;

	/** The service with only the registered list set, and the per-table graph stubbed to echo its repository. */
	const serviceWith = (repositories: Partial<IRepositoryModel>[]) => {
		const service = Object.create(RepositoriesService.prototype) as RepositoriesService;
		service.repositories = repositories as IRepositoryModel[];
		const graphOf = jest
			.spyOn(service as any, 'getRepositoryRelationsGraph')
			.mockImplementation(async (repository: any) => ({ repository, isCheckRelation: false }));
		return { service, graphOf };
	};

	it('leaves out a registered core entity marked with SkipExport', async () => {
		const { service, graphOf } = serviceWith([
			{ repository: repositoryOf(SkippedEntity) },
			{ repository: repositoryOf(ExportedEntity), isStatic: true }
		]);

		const graph = await service.buildRepositoriesRelationsGraph();

		expect(graph.map((item) => item.repository.metadata.target)).toEqual([ExportedEntity]);
		// The registration options of the tables that stay still reach the graph.
		expect(graph[0].isStatic).toBe(true);
		expect(graphOf).toHaveBeenCalledTimes(1);
	});

	it('leaves out account deletion requests even when registered', async () => {
		const { service } = serviceWith([
			{ repository: repositoryOf(AccountDeletionRequest) },
			{ repository: repositoryOf(ExportedEntity) }
		]);

		const graph = await service.buildRepositoriesRelationsGraph();

		expect(graph.map((item) => item.repository.metadata.target)).toEqual([ExportedEntity]);
	});
});
