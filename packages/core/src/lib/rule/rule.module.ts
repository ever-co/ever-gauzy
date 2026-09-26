import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Rule } from './rule.entity';
import { RuleService } from './rule.service';
import { TypeOrmRuleRepository } from './repository/type-orm-rule.repository';
import { MikroOrmRuleRepository } from './repository/mikro-orm-rule.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Rule]), MikroOrmModule.forFeature([Rule])],
	providers: [RuleService, TypeOrmRuleRepository, MikroOrmRuleRepository],
	exports: [RuleService, TypeOrmRuleRepository, MikroOrmRuleRepository]
})
export class RuleModule {}
