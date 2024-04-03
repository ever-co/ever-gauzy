import { CqrsModule } from '@nestjs/cqrs';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskStatus } from './status.entity';
import { TaskStatusController } from './status.controller';
import { TaskStatusService } from './status.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskStatus]),
		MikroOrmModule.forFeature([TaskStatus]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TaskStatusController],
	providers: [TaskStatusService, ...QueryHandlers, ...CommandHandlers],
	exports: [TaskStatusService]
})
export class TaskStatusModule {}
