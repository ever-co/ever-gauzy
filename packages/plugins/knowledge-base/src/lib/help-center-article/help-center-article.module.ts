import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '@gauzy/core';
import { HelpCenterArticle } from './help-center-article.entity';
import { HelpCenterArticleVersion } from './help-center-article-version.entity';
import { HelpCenterArticleService } from './help-center-article.service';
import { HelpCenterArticleVersionService } from './help-center-article-version.service';
import { HelpCenterArticleController } from './help-center-article.controller';
import { HelpCenterArticleVersionController } from './help-center-article-version.controller';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmHelpCenterArticleRepository } from './repository/type-orm-help-center-article.repository';
import { TypeOrmHelpCenterArticleVersionRepository } from './repository/type-orm-help-center-article-version.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([HelpCenterArticle, HelpCenterArticleVersion]),
		MikroOrmModule.forFeature([HelpCenterArticle, HelpCenterArticleVersion]),
		RolePermissionModule
	],
	controllers: [HelpCenterArticleController, HelpCenterArticleVersionController],
	providers: [
		HelpCenterArticleService,
		HelpCenterArticleVersionService,
		TypeOrmHelpCenterArticleRepository,
		TypeOrmHelpCenterArticleVersionRepository,
		...CommandHandlers
	],
	exports: [
		HelpCenterArticleService,
		HelpCenterArticleVersionService,
		TypeOrmHelpCenterArticleRepository,
		TypeOrmHelpCenterArticleVersionRepository
	]
})
export class HelpCenterArticleModule {}


