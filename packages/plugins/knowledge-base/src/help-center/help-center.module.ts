import { forwardRef, Module, OnModuleInit } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { TenantModule, UserModule } from '@gauzy/core';
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
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	providers: [HelpCenterService, ...CommandHandlers],
	controllers: [HelpCenterController],
	exports: [HelpCenterService]
})
export class HelpCenterModule implements OnModuleInit {
	constructor() {}

	onModuleInit() {}
}
