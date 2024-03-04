import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TenantModule } from './../../tenant/tenant.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { UserModule } from './../../user/user.module';
import { CommandHandlers } from './commands/handlers'
import { ImportHistory } from './import-history.entity';
import { ImportHistoryService } from './import-history.service';
import { ImportHistoryController } from './import-history.controller';

@Module({
	controllers: [
		ImportHistoryController
	],
	imports: [
		TypeOrmModule.forFeature([ImportHistory]),
		MikroOrmModule.forFeature([ImportHistory]),
		TenantModule,
		RolePermissionModule,
		UserModule,
		CqrsModule
	],
	providers: [
		ImportHistoryService,
		...CommandHandlers
	],
	exports: [
		ImportHistoryService
	]
})
export class ImportHistoryModule { }
