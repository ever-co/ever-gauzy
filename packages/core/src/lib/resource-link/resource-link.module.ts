import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { EmployeeModule } from '../employee/employee.module';
import { CommandHandlers } from './commands/handlers';
import { ResourceLink } from './resource-link.entity';
import { ResourceLinkService } from './resource-link.service';
import { ResourceLinkController } from './resource-link.controller';
import { TypeOrmResourceLinkRepository } from './repository/type-orm-resource-link.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ResourceLink]),
		MikroOrmModule.forFeature([ResourceLink]),
		RolePermissionModule,
		EmployeeModule,
		CqrsModule
	],
	controllers: [ResourceLinkController],
	providers: [ResourceLinkService, TypeOrmResourceLinkRepository, ...CommandHandlers],
	exports: []
})
export class ResourceLinkModule {}
