import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from '../../crud/tenant-aware-crud.service';
import { MikroOrmBaseEntityRepository } from '../../repository/mikro-orm-base-entity.repository';
import { PersistenceInvariantFixture } from './persistence-invariant-fixture.entity';

/**
 * Trivial `TenantAwareCrudService` subclass, on par with how every real domain service (see
 * `EmployeeService`) is just a thin subclass over the shared base — no overrides, so this suite
 * exercises `TenantAwareCrudService`'s own find/update/delete/save/paginate logic directly.
 *
 * `@Injectable()` for the same reason every other subclass of the base carries it: TypeScript emits
 * `design:paramtypes` only beside a decorated class, so an undecorated provider is constructed with
 * no arguments and every repository it names is `undefined`. This fixture is built by hand today and
 * the decorator changes nothing for it — but the rule a static gate enforces over all 311 subclasses
 * is worth more than the one exemption, and an exemption is what the next class copied from here
 * would inherit.
 */
@Injectable()
export class PersistenceInvariantService extends TenantAwareCrudService<PersistenceInvariantFixture> {
	constructor(
		typeOrmRepository: Repository<PersistenceInvariantFixture>,
		mikroOrmRepository: MikroOrmBaseEntityRepository<PersistenceInvariantFixture>
	) {
		super(typeOrmRepository, mikroOrmRepository);
	}
}
