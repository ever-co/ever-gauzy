import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { Skill } from './skill.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/skills', module: SkillModule }]),
		TypeOrmModule.forFeature([Skill]),
		TenantModule
	],
	controllers: [SkillController],
	providers: [SkillService],
	exports: [SkillService]
})
export class SkillModule {}
