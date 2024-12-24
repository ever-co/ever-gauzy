import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { Skill } from './skill.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/skills', module: SkillModule }]),
		TypeOrmModule.forFeature([Skill]),
		MikroOrmModule.forFeature([Skill]),
		RolePermissionModule
	],
	controllers: [SkillController],
	providers: [SkillService],
	exports: [SkillService]
})
export class SkillModule { }
