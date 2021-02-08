import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule, UserModule, UserService } from '@gauzy/core';
import { HelpCenterController } from './help-center.controller';
import { HelpCenter } from './help-center.entity';
import { HelpCenterService } from './help-center.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/help-center', module: HelpCenterModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([HelpCenter])),
		CqrsModule,
		TenantModule,
		UserModule
	],
	providers: [HelpCenterService, UserService, ...CommandHandlers],
	controllers: [HelpCenterController],
	exports: [HelpCenterService]
})
export class HelpCenterModule implements OnModuleInit {
	constructor() {}

	onModuleInit() {}
}
