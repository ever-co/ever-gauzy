import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { Status } from './status.entity';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/statuses', module: StatusModule }
		]),
		TypeOrmModule.forFeature([
			Status
		]),
		TenantModule,
		CqrsModule
	],
	controllers: [StatusController],
	providers: [
		StatusService,
		...QueryHandlers
	],
	exports: [StatusService]
})
export class StatusModule {}