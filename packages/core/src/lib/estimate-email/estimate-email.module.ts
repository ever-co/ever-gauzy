import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { EstimateEmailController } from './estimate-email.controller';
import { EstimateEmailService } from './estimate-email.service';
import { EstimateEmail } from './estimate-email.entity';
import { TypeOrmEstimateEmailRepository } from './repository/type-orm-estimate-email.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EstimateEmail]),
		MikroOrmModule.forFeature([EstimateEmail]),
		RolePermissionModule,
		forwardRef(() => InvoiceModule)
	],
	controllers: [EstimateEmailController],
	providers: [EstimateEmailService, TypeOrmEstimateEmailRepository],
	exports: [EstimateEmailService]
})
export class EstimateEmailModule {}
