import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
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
		forwardRef(() => TypeOrmModule.forFeature([HelpCenterArticle])),
		forwardRef(() => MikroOrmModule.forFeature([HelpCenterArticle])),
		RolePermissionModule,
		CqrsModule
	],
	providers: [HelpCenterArticleService, TypeOrmHelpCenterArticleRepository, ...CommandHandlers],
	controllers: [HelpCenterArticleController],
	exports: [HelpCenterArticleService, TypeOrmHelpCenterArticleRepository]
})
export class HelpCenterArticleModule implements OnModuleInit {
	constructor() {}

	onModuleInit() {}
}
