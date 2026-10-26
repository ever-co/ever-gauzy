import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AddressRole } from './address-role.entity';
import { AddressRoleController } from './address-role.controller';
import { AddressRoleService } from './address-role.service';
import { AddressRoleResolver } from './address-role.resolver';
import { TypeOrmAddressRoleRepository } from './repository/type-orm-address-role.repository';
import { MikroOrmAddressRoleRepository } from './repository/mikro-orm-address-role.repository';

/**
 * What a row of the address book is *for*.
 *
 * `RolePermissionModule` is imported for the guards rather than for a service: a guard is a provider of
 * whichever module hosts the handler it protects, so the permission guards the controller and the
 * resolver here carry resolve their permission lookup from *this* module.
 */
@Module({
	imports: [TypeOrmModule.forFeature([AddressRole]), MikroOrmModule.forFeature([AddressRole]), RolePermissionModule],
	controllers: [AddressRoleController],
	providers: [AddressRoleService, AddressRoleResolver, TypeOrmAddressRoleRepository, MikroOrmAddressRoleRepository],
	exports: [AddressRoleService]
})
export class AddressRoleModule {}
