import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateReaderService } from './email-template-reader.service';
import { EmailTemplateController } from './email-template.controller';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmailTemplateRepository } from './repository/type-orm-email-template.repository';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([EmailTemplate])),
		forwardRef(() => MikroOrmModule.forFeature([EmailTemplate])),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [EmailTemplateController],
	providers: [
		EmailTemplateService,
		EmailTemplateReaderService,
		TypeOrmEmailTemplateRepository,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [EmailTemplateService, TypeOrmEmailTemplateRepository]
})
export class EmailTemplateModule {}
