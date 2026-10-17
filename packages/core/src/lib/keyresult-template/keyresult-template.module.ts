import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyresultTemplateController } from './keyresult-template.controller';
import { KeyResultTemplateResolver } from './keyresult-template.resolver';
import { KeyresultTemplateService } from './keyresult-template.service';
import { KeyResultTemplate } from './keyresult-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmKeyResultTemplateRepository } from './repository/type-orm-keyresult-template.repository';
import { MikroOrmKeyResultTemplateRepository } from './repository/mikro-orm-keyresult-template.repository';

/**
 * The catalogue a key result is authored from.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `KeyresultTemplateService`; the service is exported beside it so a
 * module that hosts the resolver graph can import this one and receive what the resolver calls.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([KeyResultTemplate]),
		MikroOrmModule.forFeature([KeyResultTemplate]),
		RolePermissionModule
	],
	controllers: [KeyresultTemplateController],
	providers: [
		KeyresultTemplateService,
		// The GraphQL view of the same resource.
		KeyResultTemplateResolver,
		TypeOrmKeyResultTemplateRepository,
		MikroOrmKeyResultTemplateRepository
	],
	exports: [KeyresultTemplateService]
})
export class KeyresultTemplateModule {}