import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CqrsModule } from '@nestjs/cqrs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeRecentVisit } from './employee-recent-visit.entity';
import { EmployeeRecentVisitService } from './employee-recent-visit.service';
import { EmployeeRecentVisitController } from './employee-recent-visit.controller';
import { EventHandlers } from './events/handlers';
import { TypeOrmEmployeeRecentVisitRepository } from './repository/type-orm-employee-recent-visit.repository';

@Global()
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeRecentVisit]),
		MikroOrmModule.forFeature([EmployeeRecentVisit]),
		CqrsModule,
		RolePermissionModule
	],
	controllers: [EmployeeRecentVisitController],
	providers: [EmployeeRecentVisitService, TypeOrmEmployeeRecentVisitRepository, ...EventHandlers],
	exports: [EmployeeRecentVisitService, TypeOrmEmployeeRecentVisitRepository]
})
export class EmployeeRecentVisitModule {}
