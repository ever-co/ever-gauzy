import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateController } from './email-template.controller';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/email-template', module: EmailTemplateModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([EmailTemplate])),
		CqrsModule,
		forwardRef(() => TenantModule)
	],
	controllers: [EmailTemplateController],
	providers: [EmailTemplateService, ...QueryHandlers, ...CommandHandlers],
	exports: [TypeOrmModule, EmailTemplateService]
})
export class EmailTemplateModule {}
