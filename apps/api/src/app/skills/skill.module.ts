import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { Skill } from './skill.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

@Module({
	imports: [TypeOrmModule.forFeature([Skill])],
	controllers: [SkillController],
	providers: [SkillService],
	exports: [SkillService]
})
export class SkillModule {}
