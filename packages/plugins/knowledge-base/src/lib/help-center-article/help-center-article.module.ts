import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { HelpCenterArticle } from './help-center-article.entity';
import { HelpCenterArticleService } from './help-center-article.service';
import { HelpCenterArticleController } from './help-center-article.controller';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmHelpCenterArticleRepository } from './repository/type-orm-help-center-article.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([HelpCenterArticle]),
		MikroOrmModule.forFeature([HelpCenterArticle]),
		RolePermissionModule
	],
	controllers: [HelpCenterArticleController],
	providers: [HelpCenterArticleService, TypeOrmHelpCenterArticleRepository, ...CommandHandlers],
	exports: [HelpCenterArticleService, TypeOrmHelpCenterArticleRepository]
})
export class HelpCenterArticleModule {}
