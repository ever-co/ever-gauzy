import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { PaymentTerm } from './payment-term.entity';
import { PaymentTermLine } from './payment-term-line.entity';
import { PaymentTermController } from './payment-term.controller';
import { PaymentTermService } from './payment-term.service';
import { PaymentTermLineService } from './payment-term-line.service';
import { PaymentTermResolver } from './payment-term.resolver';
import { TypeOrmPaymentTermRepository } from './repository/type-orm-payment-term.repository';
import { MikroOrmPaymentTermRepository } from './repository/mikro-orm-payment-term.repository';
import { TypeOrmPaymentTermLineRepository } from './repository/type-orm-payment-term-line.repository';
import { MikroOrmPaymentTermLineRepository } from './repository/mikro-orm-payment-term-line.repository';

/**
 * The settlement terms and the instalments they produce.
 *
 * `RolePermissionModule` is imported for the guards rather than for a service: a guard is a provider of
 * whichever module hosts the handler it protects, so the permission guards the controller and the
 * resolver here carry resolve their permission lookup from *this* module.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([PaymentTerm, PaymentTermLine]),
		MikroOrmModule.forFeature([PaymentTerm, PaymentTermLine]),
		RolePermissionModule
	],
	controllers: [PaymentTermController],
	providers: [
		PaymentTermService,
		PaymentTermLineService,
		PaymentTermResolver,
		TypeOrmPaymentTermRepository,
		MikroOrmPaymentTermRepository,
		TypeOrmPaymentTermLineRepository,
		MikroOrmPaymentTermLineRepository
	],
	exports: [PaymentTermService, PaymentTermLineService]
})
export class PaymentTermModule {}
