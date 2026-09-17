import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { RoleEntityResolver } from './role-entity.resolver';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmRoleRepository } from './repository/type-orm-role.repository';
import { MikroOrmRoleRepository } from './repository/mikro-orm-role.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Role]),
		MikroOrmModule.forFeature([Role]),
		forwardRef(() => RolePermissionModule)
	],
	controllers: [RoleController],
	// The GraphQL resolver is declared here rather than in the module that hosts the resolvers,
	// because a resolver is an ordinary provider: it can only inject what its own module can reach.
	// Declaring it beside the service it calls is what makes `RoleService` injectable into it, and
	// the resolver host imports this module for exactly that reason.
	providers: [RoleService, RoleEntityResolver, TypeOrmRoleRepository, MikroOrmRoleRepository, ...CommandHandlers],
	exports: [RoleService, RoleEntityResolver, TypeOrmRoleRepository, MikroOrmRoleRepository]
})
export class RoleModule {}
