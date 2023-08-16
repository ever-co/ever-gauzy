import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from './../../tenant/tenant.module';
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
		TypeOrmModule.forFeature([
			ImportHistory
		]),
		TenantModule,
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
