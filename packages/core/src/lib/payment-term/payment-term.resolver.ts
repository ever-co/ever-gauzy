import { NotFoundException, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { CurrencyCode, DecimalString } from '@gauzy/contracts';
import { PaymentTerm } from './payment-term.entity';
import { IPaymentTermSchedule, PaymentTermService } from './payment-term.service';
import { PAYMENT_TERM_PERMISSIONS } from './payment-term.permissions';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { PaymentDueBasis, PaymentTermLineType } from './payment-term.enums';

/** One instalment as `PaymentTermLineInput` declares it. */
export interface IPaymentTermLineArgs {
	sequence?: number;
	valueType?: PaymentTermLineType;
	valueAmount: DecimalString;
	currency?: CurrencyCode;
	dueBasis?: PaymentDueBasis;
	days?: number;
	dayOfMonth?: number;
}

/** The members `CreatePaymentTermInput` declares in the schema. */
export interface ICreatePaymentTermInput {
	organizationId: string;
	name: string;
	code: string;
	description?: string;
	isDefault?: boolean;
	lines: IPaymentTermLineArgs[];
}

/** The members `UpdatePaymentTermInput` declares in the schema. */
export interface IUpdatePaymentTermInput {
	id: string;
	organizationId: string;
	name?: string;
	code?: string;
	description?: string;
	isDefault?: boolean;
}

/** The members `UpdatePaymentTermLinesInput` declares in the schema. */
export interface IUpdatePaymentTermLinesInput {
	id: string;
	organizationId: string;
	lines: IPaymentTermLineArgs[];
}

/**
 * The settlement terms, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `PaymentTermService` the `/api/payment-terms` routes call,
 * under the same guard chain and the same permissions. The schedule field is the same derivation
 * `POST /api/payment-terms/:id/schedule` performs — nothing is written, and the answer depends on the
 * amount and basis date the caller supplies.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('PaymentTerm')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_VIEW)
export class PaymentTermResolver {
	constructor(private readonly paymentTermService: PaymentTermService) {}

	/**
	 * The settlement terms of the caller's organization.
	 */
	@Query('paymentTerms')
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_VIEW)
	async paymentTerms(): Promise<PaymentTerm[]> {
		const { items } = await this.paymentTermService.findAll();

		return items;
	}

	/**
	 * One term with its instalments, or `null` when this organization has none with that id.
	 */
	@Query('paymentTerm')
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_VIEW)
	async paymentTerm(@Args('id', ParseUUIDPipe) id: string): Promise<PaymentTerm | null> {
		try {
			return await this.paymentTermService.getTerm(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The schedule a term produces for one amount.
	 */
	@Query('paymentTermSchedule')
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_VIEW)
	async paymentTermSchedule(
		@Args('id', ParseUUIDPipe) id: string,
		@Args('total') total: DecimalString,
		@Args('basisDate') basisDate: string,
		@Args('currencyDecimals', { nullable: true }) currencyDecimals?: number,
		@Args('currency', { nullable: true }) currency?: CurrencyCode
	): Promise<IPaymentTermSchedule> {
		return this.paymentTermService.schedule(id, total, currencyDecimals ?? 2, basisDate, currency);
	}

	/**
	 * Declares a term and the instalments that make up its schedule.
	 */
	@Mutation('createPaymentTerm')
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	async createPaymentTerm(@Args('input') input: ICreatePaymentTermInput): Promise<PaymentTerm> {
		return this.paymentTermService.createTerm(input);
	}

	/**
	 * Changes a term's header fields.
	 */
	@Mutation('updatePaymentTerm')
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	async updatePaymentTerm(@Args('input') input: IUpdatePaymentTermInput): Promise<PaymentTerm> {
		return this.paymentTermService.updateTerm(input.id, input);
	}

	/**
	 * Replaces a term's instalments.
	 */
	@Mutation('updatePaymentTermLines')
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	async updatePaymentTermLines(@Args('input') input: IUpdatePaymentTermLinesInput): Promise<PaymentTerm> {
		return this.paymentTermService.updateLines(input.id, input.lines);
	}

	/**
	 * Archives a term.
	 */
	@Mutation('archivePaymentTerm')
	@Permissions(PAYMENT_TERM_PERMISSIONS.PAYMENT_TERMS_EDIT)
	async archivePaymentTerm(@Args('id', ParseUUIDPipe) id: string): Promise<boolean> {
		await this.paymentTermService.getTerm(id);
		await this.paymentTermService.softRemove(id);

		return true;
	}
}
