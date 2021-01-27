import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateController } from './email-template.controller';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([EmailTemplate])),
		CqrsModule,
		forwardRef(() => TenantModule)
	],
	controllers: [EmailTemplateController],
	providers: [EmailTemplateService, ...QueryHandlers, ...CommandHandlers],
	exports: [TypeOrmModule, EmailTemplateService]
})
export class EmailTemplateModule {}
