import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateReaderService } from './email-template-reader.service';
import { EmailTemplateController } from './email-template.controller';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/email-template', module: EmailTemplateModule }]),
		forwardRef(() => TypeOrmModule.forFeature([EmailTemplate])),
		forwardRef(() => MikroOrmModule.forFeature([EmailTemplate])),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [EmailTemplateController],
	providers: [
		EmailTemplateService,
		EmailTemplateReaderService,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [TypeOrmModule, MikroOrmModule, EmailTemplateService]
})
export class EmailTemplateModule { }
