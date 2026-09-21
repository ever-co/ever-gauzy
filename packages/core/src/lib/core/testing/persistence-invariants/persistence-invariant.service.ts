import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../../crud/tenant-aware-crud.service';
import { MikroOrmBaseEntityRepository } from '../../repository/mikro-orm-base-entity.repository';
import { PersistenceInvariantFixture } from './persistence-invariant-fixture.entity';

/**
 * Trivial `TenantAwareCrudService` subclass, on par with how every real domain service (see
 * `EmployeeService`) is just a thin subclass over the shared base — no overrides, so this suite
 * exercises `TenantAwareCrudService`'s own find/update/delete/save/paginate logic directly.
 */
export class PersistenceInvariantService extends TenantAwareCrudService<PersistenceInvariantFixture> {
	constructor(
		typeOrmRepository: Repository<PersistenceInvariantFixture>,
		mikroOrmRepository: MikroOrmBaseEntityRepository<PersistenceInvariantFixture>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}
}
