import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule, UserModule, UserService } from '@gauzy/core';
import { HelpCenterAuthorService } from './help-center-author.service';
import { HelpCenterAuthorController } from './help-center-author.controller';
import { HelpCenterAuthor } from './help-center-author.entity';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/help-center-author', module: HelpCenterAuthorModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([HelpCenterAuthor])),
		CqrsModule,
		TenantModule,
		UserModule
	],
	providers: [HelpCenterAuthorService, UserService, ...CommandHandlers],
	controllers: [HelpCenterAuthorController],
	exports: [HelpCenterAuthorService]
})
export class HelpCenterAuthorModule implements OnModuleInit {
	constructor() {}

	onModuleInit() {}
}
