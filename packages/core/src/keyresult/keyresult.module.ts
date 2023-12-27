import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KeyResult } from './keyresult.entity';
import { KeyResultService } from './keyresult.service';
import { KeyResultController } from './keyresult.controller';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/key-results', module: KeyResultModule }]),
		TypeOrmModule.forFeature([KeyResult]),
		CqrsModule,
		TenantModule
	],
	controllers: [KeyResultController],
	providers: [KeyResultService],
	exports: [KeyResultService]
})
export class KeyResultModule {}
