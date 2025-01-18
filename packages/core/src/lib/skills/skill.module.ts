import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { Skill } from './skill.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmSkillRepository } from './repository/type-orm-skill.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Skill]), MikroOrmModule.forFeature([Skill]), RolePermissionModule],
	controllers: [SkillController],
	providers: [SkillService, TypeOrmSkillRepository]
})
export class SkillModule {}
