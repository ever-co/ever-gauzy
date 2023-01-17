import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { Status } from './status.entity';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { CommandHandlers } from './commands/handlers';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/statuses', module: StatusModule }
		]),
		TypeOrmModule.forFeature([ Status ]),
		TenantModule,
		CqrsModule,
	],
	controllers: [StatusController],
	providers: [
		StatusService,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [StatusService],
})
export class StatusModule {}
