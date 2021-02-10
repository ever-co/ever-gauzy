import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { KeyResultUpdateService } from './keyresult-update.service';
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdate } from './keyresult-update.entity';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/key-result-updates', module: KeyResultUpdateModule }
		]),
		TypeOrmModule.forFeature([KeyResultUpdate]),
		CqrsModule,
		TenantModule
	],
	controllers: [KeyResultUpdateController],
	providers: [KeyResultUpdateService, ...CommandHandlers],
	exports: [KeyResultUpdateService]
})
export class KeyResultUpdateModule {}
