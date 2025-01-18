import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { Dashboard } from './dashboard.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { TypeOrmDashboardRepository } from './repository/type-orm-dashboard.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Dashboard]),
		MikroOrmModule.forFeature([Dashboard]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [DashboardController],
	providers: [DashboardService, TypeOrmDashboardRepository, ...CommandHandlers],
	exports: []
})
export class DashboardModule {}
