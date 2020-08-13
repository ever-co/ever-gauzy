import { Module } from '@nestjs/common';
import { GoalTemplateController } from './goal-template.controller';
import { GoalTemplateService } from './goal-template.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalTemplate } from './goal-template.entity';

@Module({
	imports: [TypeOrmModule.forFeature([GoalTemplate])],
	controllers: [GoalTemplateController],
	providers: [GoalTemplateService],
	exports: [GoalTemplateService]
})
export class GoalTemplateModule {}
