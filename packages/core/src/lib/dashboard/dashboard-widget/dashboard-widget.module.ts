import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { DashboardWidget } from './dashboard-widget.entity';
import { DashboardWidgetService } from './dashboard-widget.service';
import { DashboardWidgetController } from './dashboard-widget.controller';
import { TypeOrmDashboardWidgetRepository } from './repository/type-orm-dashboard-widget.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([DashboardWidget]),
		MikroOrmModule.forFeature([DashboardWidget]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [DashboardWidgetController],
	providers: [DashboardWidgetService, TypeOrmDashboardWidgetRepository, ...CommandHandlers],
	exports: []
})
export class DashboardWidgetModule {}
