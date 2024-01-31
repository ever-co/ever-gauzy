import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { KeyResultUpdateService } from './keyresult-update.service';
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdate } from './keyresult-update.entity';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/key-result-updates', module: KeyResultUpdateModule }]),
		TypeOrmModule.forFeature([KeyResultUpdate]),
		MikroOrmModule.forFeature([KeyResultUpdate]),
		CqrsModule,
		TenantModule
	],
	controllers: [KeyResultUpdateController],
	providers: [KeyResultUpdateService, ...CommandHandlers],
	exports: [KeyResultUpdateService]
})
export class KeyResultUpdateModule { }
