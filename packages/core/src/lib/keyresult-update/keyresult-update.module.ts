import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyResultUpdateService } from './keyresult-update.service';
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdate } from './keyresult-update.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/key-result-updates', module: KeyResultUpdateModule }]),
		TypeOrmModule.forFeature([KeyResultUpdate]),
		MikroOrmModule.forFeature([KeyResultUpdate]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [KeyResultUpdateController],
	providers: [KeyResultUpdateService, ...CommandHandlers],
	exports: [KeyResultUpdateService]
})
export class KeyResultUpdateModule { }
