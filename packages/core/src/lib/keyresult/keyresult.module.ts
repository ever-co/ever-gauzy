import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyResult } from './keyresult.entity';
import { KeyResultService } from './keyresult.service';
import { KeyResultController } from './keyresult.controller';
import { KeyResultResolver } from './keyresult.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmKeyResultRepository } from './repository/type-orm-keyresult.repository';
import { MikroOrmKeyResultRepository } from './repository/mikro-orm-keyresult.repository';

/**
 * The measurable half of an objective.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `KeyResultService`; the service is exported beside it so a module
 * that hosts the resolver graph can import this one and receive what the resolver calls. The bulk
 * write is a service method rather than a command, so no bus has to be handed on beside it.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([KeyResult]),
		MikroOrmModule.forFeature([KeyResult]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [KeyResultController],
	providers: [
		KeyResultService,
		// The GraphQL view of the same resource.
		KeyResultResolver,
		TypeOrmKeyResultRepository,
		MikroOrmKeyResultRepository
	],
	exports: [KeyResultService]
})
export class KeyResultModule {}