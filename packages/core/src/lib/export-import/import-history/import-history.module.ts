import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { ImportHistory } from './import-history.entity';
import { ImportHistoryService } from './import-history.service';
import { ImportHistoryController } from './import-history.controller';
import { ImportHistoryResolver } from './import-history.resolver';
import { TypeOrmImportHistoryRepository } from './repository/type-orm-import-history.repository';
import { MikroOrmImportHistoryRepository } from './repository/mikro-orm-import-history.repository';

/**
 * The import ledger.
 *
 * The GraphQL view of the same resource is declared here beside the controller: a resolver is a provider
 * of whichever module the Apollo configuration names, and it can only inject services its own module can
 * reach — which is why it belongs beside the service it calls rather than in the module that hosts the
 * platform's other resolvers.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ImportHistory]),
		MikroOrmModule.forFeature([ImportHistory]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ImportHistoryController],
	providers: [
		ImportHistoryService,
		ImportHistoryResolver,
		TypeOrmImportHistoryRepository,
		MikroOrmImportHistoryRepository,
		...CommandHandlers
	],
	exports: [ImportHistoryService]
})
export class ImportHistoryModule {}