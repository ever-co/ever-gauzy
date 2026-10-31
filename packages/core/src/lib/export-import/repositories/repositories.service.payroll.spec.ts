import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Employee, Organization, PayrollItem, PayrollRun, Tenant, User } from '../../core/entities/internal';
import { withStubTypeOrmRepositories } from '../../core/testing/registered-repositories/registered-repositories.fixtures';
import { IRepositoryModel, RepositoriesService } from './repositories.service';

/**
 * #10184 item 3: `payroll_run` and `payroll_item` were not registered, so an organization export left payroll
 * out of the archive and an import of an archive that carried it skipped it.
 *
 * The import walks the registered list in order and remaps every foreign key through the import record of a row
 * imported EARLIER, so a table registered before a table it references loses that reference (a line item would
 * lose its run, and `payrollRunId` is required). The dependencies are read from the entities' own relation
 * metadata rather than restated here, so a reference added to either entity later is checked too.
 */
describe('RepositoriesService — payroll registration', () => {
	/** The registered entities, in the order the export writes and the import reads them. */
	const registrationOrder = async (): Promise<{ service: RepositoriesService; order: Function[] }> => {
		const bare = Object.create(RepositoriesService.prototype) as RepositoriesService;
		bare.dynamicEntitiesClassMap = [];
		const service = withStubTypeOrmRepositories(bare, (entity, entityName) => ({
			metadata: { target: entity, tableName: entityName }
		}));
		await (service as any).registerCoreRepositories();
		return { service, order: service.repositories.map((item) => item.repository.metadata.target as Function) };
	};

	/** The entities `entity` holds a many-to-one foreign key to, its base classes' included. */
	const referencedEntities = (entity: Function): Function[] => {
		const owners = new Set<Function>();
		for (let cursor = entity; typeof cursor === 'function' && cursor.name; cursor = Object.getPrototypeOf(cursor)) {
			owners.add(cursor);
		}
		const referenced = getMetadataArgsStorage()
			.relations.filter((relation) => owners.has(relation.target as Function))
			.filter((relation) => relation.relationType === 'many-to-one')
			.map((relation) => (relation.type as () => Function)());
		return [...new Set(referenced)].filter((referencedEntity) => referencedEntity !== entity);
	};

	it('registers both payroll tables', async () => {
		const { order } = await registrationOrder();

		expect(order).toContain(PayrollRun);
		expect(order).toContain(PayrollItem);
	});

	it('reads the dependencies it checks from the entities themselves', () => {
		// Without this, a metadata lookup that found nothing would let the ordering checks below pass vacuously.
		expect(referencedEntities(PayrollRun)).toEqual(expect.arrayContaining([Tenant, Organization, User]));
		expect(referencedEntities(PayrollItem)).toEqual(
			expect.arrayContaining([Tenant, Organization, PayrollRun, Employee])
		);
	});

	it.each([
		['payroll_run', PayrollRun],
		['payroll_item', PayrollItem]
	])('registers %s after every table it holds a foreign key to', async (_table, entity) => {
		const { order } = await registrationOrder();
		const position = order.indexOf(entity);

		for (const referenced of referencedEntities(entity)) {
			const referencedPosition = order.indexOf(referenced);

			expect({ referenced: referenced.name, registered: referencedPosition >= 0 }).toEqual({
				referenced: referenced.name,
				registered: true
			});
			expect({ referenced: referenced.name, before: referencedPosition < position }).toEqual({
				referenced: referenced.name,
				before: true
			});
		}
	});

	it('exports payroll rows of the exporting tenant only, never tenantless rows as shared defaults', async () => {
		const { service } = await registrationOrder();
		jest.spyOn(service as any, 'getRepositoryRelationsGraph').mockImplementation(async (repository: any) => ({
			repository,
			isCheckRelation: false
		}));

		const graph: IRepositoryModel[] = await service.buildRepositoriesRelationsGraph();
		const payrollEntities: Function[] = [PayrollRun, PayrollItem];
		const payroll = graph.filter((item) => payrollEntities.includes(item.repository.metadata.target as Function));

		expect(payroll.map((item) => item.repository.metadata.target)).toEqual([PayrollRun, PayrollItem]);
		expect(payroll.every((item) => item.excludeGlobalDefaults === true)).toBe(true);
	});
});
