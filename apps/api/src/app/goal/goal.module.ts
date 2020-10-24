import { Module } from '@nestjs/common';
import { GoalController } from './goal.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './goal.entity';
import { GoalService } from './goal.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([Goal]), TenantModule],
	controllers: [GoalController],
	providers: [GoalService],
	exports: [GoalService]
})
export class GoalModule {}
