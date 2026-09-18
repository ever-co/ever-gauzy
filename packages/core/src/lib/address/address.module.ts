import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AddressRoleModule } from '../address-role/address-role.module';
import { Address } from './address.entity';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { AddressResolver } from './address.resolver';
import { TypeOrmAddressRepository } from './repository/type-orm-address.repository';
import { MikroOrmAddressRepository } from './repository/mikro-orm-address.repository';

/**
 * The address book: the kernel's postal addresses, and the rules their rows cannot hold.
 *
 * **Both ORMs are registered**, because the kernel is dual-ORM: the entity decorators map the table for
 * whichever mapper the deployment runs, and the repository pair is provided here so a service injected
 * with one is resolved from the module that declares its table rather than from whichever module
 * happens to import this one first.
 *
 * **The repository classes are exported as well as the service.** A consumer that composes the table
 * itself — a checkout resolving a ship-to, an import reconciling a book, the nightly
 * `address-default-reconcile` — needs the same repository the service writes through, and
 * re-providing it elsewhere would give it a second instance over the same table.
 *
 * **`AddressRoleModule` is imported because the default is one fact in three places.**
 * `AddressService` writes the `SHIPPING` / `BILLING` role rows in the same transaction as the
 * address's own boolean and the party's authoritative column, and the pivot's `setDefault` is what
 * clears the siblings, so the rule stays stated once, in the service that owns it.
 *
 * **`RolePermissionModule` is imported for the guards rather than for a service.** The controller and
 * the resolver that carry `/addresses` are providers of this module, and a guard is a provider of
 * whichever module hosts the handler it protects, so the module that hosts them has to be able to
 * reach the permission lookup those guards ask for. Importing it here is what makes this module the
 * one place a handler is added.
 *
 * **The controller and the resolver are declared and exported here**, beside the service they call:
 * a resolver can only inject services its own module can reach, and the composition module the Apollo
 * configuration names imports this one so the resolver is discovered without a second registration.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Address]),
		MikroOrmModule.forFeature([Address]),
		RolePermissionModule,
		AddressRoleModule
	],
	controllers: [AddressController],
	providers: [AddressService, AddressResolver, TypeOrmAddressRepository, MikroOrmAddressRepository],
	exports: [AddressService, AddressResolver, TypeOrmAddressRepository, MikroOrmAddressRepository]
})
export class AddressModule {}
