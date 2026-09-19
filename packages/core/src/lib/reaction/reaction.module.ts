import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { CommandHandlers } from './commands/handlers';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { ReactionResolver } from './reaction.resolver';
import { Reaction } from './reaction.entity';
import { TypeOrmReactionRepository } from './repository/type-orm-reaction.repository';
import { MikroOrmReactionRepository } from './repository/mikro-orm-reaction.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([Reaction]),
		MikroOrmModule.forFeature([Reaction]),
		RolePermissionModule,
		EmployeeModule
	],
	controllers: [ReactionController],
	providers: [
		ReactionService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches the service and the bus
		// behind both of its write surfaces.
		ReactionResolver,
		TypeOrmReactionRepository,
		MikroOrmReactionRepository,
		...CommandHandlers
	],
	// `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
	// dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
	// configuration names, so a module that imports this one receives the command bus only if this
	// module hands it on. The REST controller beside it resolves the bus from this module's own imports,
	// which is why nothing needed re-exporting until the GraphQL view of the same resource existed.
	exports: [CqrsModule]
})
export class ReactionModule {}