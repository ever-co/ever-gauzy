import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TenantModule, UserModule } from '@gauzy/core';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateReaderService } from './email-template-reader.service';
import { EmailTemplateController } from './email-template.controller';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';


@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([
			EmailTemplate
		])),
		forwardRef(() => MikroOrmModule.forFeature([
			EmailTemplate
		])),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [
		EmailTemplateController
	],
	providers: [
		EmailTemplateService,
		EmailTemplateReaderService,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		MikroOrmModule,
		EmailTemplateService
	]
})
export class EmailTemplateModule { }
