import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule, User, UserService } from '@gauzy/core';
import { HelpCenterAuthorService } from './help-center-author.service';
import { HelpCenterAuthorController } from './help-center-author.controller';
import { HelpCenterAuthor } from './help-center-author.entity';
import { CommandHandlers } from './commands/handlers';
import { RouterModule } from 'nest-router';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/help-center-author', module: HelpCenterAuthorModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([HelpCenterAuthor, User])),
		CqrsModule,
		TenantModule
	],
	providers: [HelpCenterAuthorService, UserService, ...CommandHandlers],
	controllers: [HelpCenterAuthorController],
	exports: [HelpCenterAuthorService]
})
export class HelpCenterAuthorModule implements OnModuleInit {
	constructor() {}

	onModuleInit() {}
}
