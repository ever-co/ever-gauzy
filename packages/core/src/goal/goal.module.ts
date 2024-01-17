import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { GoalController } from './goal.controller';
import { Goal } from './goal.entity';
import { GoalService } from './goal.service';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/goals', module: GoalModule }]),
		TypeOrmModule.forFeature([Goal]),
		MikroOrmModule.forFeature([Goal]),
		TenantModule
	],
	controllers: [GoalController],
	providers: [GoalService],
	exports: [GoalService]
})
export class GoalModule { }
