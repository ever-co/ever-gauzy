import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { CacheModule } from '@nestjs/cache-manager';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionResolver } from './role-permission.resolver';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';
import { RoleModule } from './../role/role.module';
import { TypeOrmRolePermissionRepository } from './repository/type-orm-role-permission.repository';
import { MikroOrmRolePermissionRepository } from './repository/mikro-orm-role-permission.repository';

/**
 * The permissions a role carries.
 *
 * `RolePermissionResolver` is declared here rather than in the module that hosts the resolvers,
 * because a resolver is an ordinary provider: it can only inject what its own module can reach.
 * Declaring it beside the service it calls is what makes `RolePermissionService` injectable into it,
 * and the module that hosts the resolver imports this one for exactly that reason — the service is
 * exported, so the hosting module resolves the field's dependencies whether it declares the resolver
 * itself or receives the instance this module provides.
 */
@Module({
	imports: [
		CqrsModule,
		CacheModule.register({ isGlobal: true }),
		TypeOrmModule.forFeature([RolePermission]),
		MikroOrmModule.forFeature([RolePermission]),
		forwardRef(() => RoleModule)
	],
	controllers: [RolePermissionController],
	providers: [
		RolePermissionService,
		// The GraphQL view of the same resource, declared beside the service it calls — see the note
		// above. It injects the service and nothing else, so the exports below are what the module that
		// hosts it needs.
		RolePermissionResolver,
		TypeOrmRolePermissionRepository,
		MikroOrmRolePermissionRepository
	],
	exports: [
		CacheModule,
		RolePermissionService,
		RolePermissionResolver,
		TypeOrmRolePermissionRepository,
		MikroOrmRolePermissionRepository
	]
})
export class RolePermissionModule {}
