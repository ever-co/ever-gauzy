import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SkillService } from './skill.service';
import { SkillController } from './skill.controller';
import { SkillResolver } from './skill.resolver';
import { Skill } from './skill.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmSkillRepository } from './repository/type-orm-skill.repository';
import { MikroOrmSkillRepository } from './repository/mikro-orm-skill.repository';

/**
 * The skill vocabulary.
 *
 * The resolver is declared here, beside the service it calls: a resolver is an ordinary Nest provider
 * and can only inject what the module hosting it can reach. It adds one provider and no second
 * dependency.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Skill]), MikroOrmModule.forFeature([Skill]), RolePermissionModule],
	controllers: [SkillController],
	providers: [
		SkillService,
		// The GraphQL view of the same resource.
		SkillResolver,
		TypeOrmSkillRepository,
		MikroOrmSkillRepository
	]
})
export class SkillModule {}