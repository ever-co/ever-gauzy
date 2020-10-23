import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { Skill } from './skill.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([Skill]), TenantModule],
	controllers: [SkillController],
	providers: [SkillService],
	exports: [SkillService]
})
export class SkillModule {}
