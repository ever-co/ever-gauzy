import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { ImportHistory } from './import-history.entity';
import { ImportHistoryService } from './import-history.service';
import { ImportHistoryController } from './import-history.controller';
import { TypeOrmImportHistoryRepository } from './repository/type-orm-import-history.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ImportHistory]),
		MikroOrmModule.forFeature([ImportHistory]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ImportHistoryController],
	providers: [ImportHistoryService, TypeOrmImportHistoryRepository, ...CommandHandlers]
})
export class ImportHistoryModule {}
