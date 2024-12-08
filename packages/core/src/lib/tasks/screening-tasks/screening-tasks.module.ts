import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScreeningTasksService } from './screening-tasks.service';
import { ScreeningTasksController } from './screening-tasks.controller';
import { ScreeningTask } from './screening-task.entity';
import { TypeOrmScreeningTaskRepository } from './repository/type-orm-screening-task.repository';

@Module({
	imports: [TypeOrmModule.forFeature([ScreeningTask]), MikroOrmModule.forFeature([ScreeningTask])],
	providers: [ScreeningTasksService, TypeOrmScreeningTaskRepository],
	controllers: [ScreeningTasksController],
	exports: [ScreeningTasksService, TypeOrmModule, TypeOrmScreeningTaskRepository]
})
export class ScreeningTasksModule {}
