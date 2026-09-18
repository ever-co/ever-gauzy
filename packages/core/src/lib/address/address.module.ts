import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AddressRoleModule } from '../address-role/address-role.module';
import { Address } from './address.entity';
import { AddressService } from './address.service';
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
 * **`RolePermissionModule` is imported for the guards rather than for a service.** This module owns no
 * HTTP handler today — the controller and the resolvers that will carry `/addresses` are a later
 * wave — and a guard is a provider of whichever module hosts the handler it protects, so the module
 * that will host them has to be able to reach the permission lookup those guards ask for. Importing it
 * here is what makes this module the one place a handler is added, rather than a second edit a later
 * change has to remember.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Address]),
		MikroOrmModule.forFeature([Address]),
		RolePermissionModule,
		AddressRoleModule
	],
	providers: [AddressService, TypeOrmAddressRepository, MikroOrmAddressRepository],
	exports: [AddressService, TypeOrmAddressRepository, MikroOrmAddressRepository]
})
export class AddressModule {}
