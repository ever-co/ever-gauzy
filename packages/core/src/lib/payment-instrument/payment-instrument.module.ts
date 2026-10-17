import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { PaymentAccountHolder } from '../payment-account-holder/payment-account-holder.entity';
import { PaymentAccountHolderService } from '../payment-account-holder/payment-account-holder.service';
import { TypeOrmPaymentAccountHolderRepository } from '../payment-account-holder/repository/type-orm-payment-account-holder.repository';
import { MikroOrmPaymentAccountHolderRepository } from '../payment-account-holder/repository/mikro-orm-payment-account-holder.repository';
import { PaymentMethodToken } from '../payment-method-token/payment-method-token.entity';
import { PaymentMethodTokenService } from '../payment-method-token/payment-method-token.service';
import { TypeOrmPaymentMethodTokenRepository } from '../payment-method-token/repository/type-orm-payment-method-token.repository';
import { MikroOrmPaymentMethodTokenRepository } from '../payment-method-token/repository/mikro-orm-payment-method-token.repository';
import { PaymentInstrumentEligibilityService } from './payment-instrument-eligibility.service';

/**
 * The remembered payer: the account at a provider, the instruments saved under it, and the one question
 * a party that remembered a payer asks.
 *
 * **Both ORMs are registered**, because the kernel is dual-ORM: the entity decorators map the two
 * tables for whichever mapper the deployment runs, and each repository pair is provided here so a
 * service injected with one is resolved from the module that declares its table rather than from
 * whichever module happens to import this one first.
 *
 * **The repository classes are exported as well as the services.** A consumer that composes the two
 * tables itself — the sweep that expires instruments, a reconciliation that reads a provider's account
 * list — needs the same repository the services write through, and re-providing it elsewhere would give
 * it a second instance over the same table.
 *
 * **`RolePermissionModule` is imported for the guards rather than for a service.** This module owns no
 * HTTP handler today, but a guard is a provider of whichever module hosts the handler it protects, so
 * the module that will host this domain's controllers and resolvers has to be able to reach the
 * permission lookup those guards ask for. Importing it here is what makes this module the one place a
 * handler is added, rather than a second edit a later change has to remember.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([PaymentAccountHolder, PaymentMethodToken]),
		MikroOrmModule.forFeature([PaymentAccountHolder, PaymentMethodToken]),
		RolePermissionModule
	],
	providers: [
		PaymentAccountHolderService,
		PaymentMethodTokenService,
		PaymentInstrumentEligibilityService,
		TypeOrmPaymentAccountHolderRepository,
		MikroOrmPaymentAccountHolderRepository,
		TypeOrmPaymentMethodTokenRepository,
		MikroOrmPaymentMethodTokenRepository
	],
	exports: [
		PaymentAccountHolderService,
		PaymentMethodTokenService,
		PaymentInstrumentEligibilityService,
		TypeOrmPaymentAccountHolderRepository,
		MikroOrmPaymentAccountHolderRepository,
		TypeOrmPaymentMethodTokenRepository,
		MikroOrmPaymentMethodTokenRepository
	]
})
export class PaymentInstrumentModule {}
