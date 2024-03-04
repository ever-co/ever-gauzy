import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyResult } from './keyresult.entity';
import { KeyResultService } from './keyresult.service';
import { KeyResultController } from './keyresult.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/key-results', module: KeyResultModule }]),
		TypeOrmModule.forFeature([KeyResult]),
		MikroOrmModule.forFeature([KeyResult]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [KeyResultController],
	providers: [KeyResultService],
	exports: [KeyResultService]
})
export class KeyResultModule { }
