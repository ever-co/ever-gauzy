import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateReaderService } from './email-template-reader.service';
import { EmailTemplateController } from './email-template.controller';
import { EmailTemplateResolver } from './email-template.resolver';
import { QueryHandlers } from './queries/handlers';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmailTemplateRepository } from './repository/type-orm-email-template.repository';
import { MikroOrmEmailTemplateRepository } from './repository/mikro-orm-email-template.repository';

/**
 * The message templates.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependencies resolvable: a resolver is a provider of whichever module the Apollo configuration names,
 * so a module that imports this one receives the query and command buses only if this module hands them
 * on. The REST controller beside it resolves both buses from this module's own imports, which is why
 * nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([EmailTemplate]),
		MikroOrmModule.forFeature([EmailTemplate]),
		RolePermissionModule
	],
	controllers: [EmailTemplateController],
	providers: [
		EmailTemplateService,
		EmailTemplateReaderService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		EmailTemplateResolver,
		TypeOrmEmailTemplateRepository, MikroOrmEmailTemplateRepository,
		...QueryHandlers,
		...CommandHandlers
	],
	exports: [
		EmailTemplateService,
		TypeOrmEmailTemplateRepository,
		MikroOrmEmailTemplateRepository,
		CqrsModule
	]
})
export class EmailTemplateModule {}