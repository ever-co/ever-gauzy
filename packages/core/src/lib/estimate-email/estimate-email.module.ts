import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { EstimateEmailController } from './estimate-email.controller';
import { EstimateEmailResolver } from './estimate-email.resolver';
import { EstimateEmailService } from './estimate-email.service';
import { EstimateEmail } from './estimate-email.entity';
import { TypeOrmEstimateEmailRepository } from './repository/type-orm-estimate-email.repository';
import { MikroOrmEstimateEmailRepository } from './repository/mikro-orm-estimate-email.repository';

/**
 * The estimate email.
 *
 * This module sits inside a service cycle with the invoice module — the estimate email needs the invoice
 * repository and the invoice module states it back — so the resolver is declared here beside the service
 * rather than in the module that hosts the platform's other resolvers: a resolver can only inject what
 * its own module can reach, and importing this module from the host is the edge the cycle forbids.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EstimateEmail]),
		MikroOrmModule.forFeature([EstimateEmail]),
		RolePermissionModule,
		forwardRef(() => InvoiceModule)
	],
	controllers: [EstimateEmailController],
	providers: [
		EstimateEmailService,
		EstimateEmailResolver,
		TypeOrmEstimateEmailRepository,
		MikroOrmEstimateEmailRepository
	],
	exports: [EstimateEmailService]
})
export class EstimateEmailModule {}