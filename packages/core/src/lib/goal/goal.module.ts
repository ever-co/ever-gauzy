import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalController } from './goal.controller';
import { Goal } from './goal.entity';
import { GoalService } from './goal.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalRepository } from './repository/type-orm-goal.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Goal]), MikroOrmModule.forFeature([Goal]), RolePermissionModule],
	controllers: [GoalController],
	providers: [GoalService, TypeOrmGoalRepository]
})
export class GoalModule {}
