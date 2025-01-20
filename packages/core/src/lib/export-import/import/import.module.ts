import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { getConfig } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { coreEntities } from '../../core/entities';
import { CommandHandlers } from './commands/handlers';
import { ImportRecordModule } from '../import-record';
import { ImportHistoryModule } from '../import-history';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { UserModule } from '../../user/user.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([...coreEntities, ...getEntitiesFromPlugins(getConfig().plugins)]),
		MikroOrmModule.forFeature([...coreEntities, ...getEntitiesFromPlugins(getConfig().plugins)]),
		RolePermissionModule,
		UserModule,
		ImportRecordModule,
		ImportHistoryModule,
		CqrsModule
	],
	controllers: [ImportController],
	providers: [ImportService, ...CommandHandlers]
})
export class ImportModule {}
