import { ID, PluginBillingStatus } from '@gauzy/contracts';
import { MultiORMEnum, parseFindOptionsRelations, RequestContext } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { Between, LessThan, UpdateResult } from 'typeorm';
import {
	IPluginBilling,
	IPluginBillingCreateInput,
	IPluginBillingFindInput,
	IPluginBillingSummary,
	IPluginBillingUpdateInput
} from '../../shared/models/plugin-billing.model';
import { IPluginSubscription } from '../../shared/models/plugin-subscription.model';
import { PluginBilling } from '../entities/plugin-billing.entity';
import { PluginSubscription } from '../entities/plugin-subscription.entity';
import { MikroOrmPluginBillingRepository, TypeOrmPluginBillingRepository } from '../repositories';
import { RegistryTenantAwareCrudService } from './registry-crud.service';

@Injectable()
export class PluginBillingService extends RegistryTenantAwareCrudService<PluginBilling> {
	constructor(
		public readonly typeOrmPluginBillingRepository: TypeOrmPluginBillingRepository,
		public readonly mikroOrmPluginBillingRepository: MikroOrmPluginBillingRepository
	) {
		super(typeOrmPluginBillingRepository, mikroOrmPluginBillingRepository);
	}

	/**
	 * Create billing record
	 */
	async create(input: IPluginBillingCreateInput): Promise<PluginBilling> {
		return await super.create(input);
	}

	/**
	 * Update billing record
	 */
	async update(id: string, input: IPluginBillingUpdateInput): Promise<PluginBilling | UpdateResult> {
		const existing = await this.findOneByIdString(id);
		if (!existing) {
			throw new Error(`Billing record with ID '${id}' not found`);
		}

		return super.update(id, input);
	}

	/**
	 * Find billing records with advanced filtering
	 */
	async findBillings(options: IPluginBillingFindInput): Promise<IPluginBilling[]> {
		// These reads go to the repository, past the tenant scope of the base service: scope them here, or a
		// subscription id of another tenant reads that tenant's billings. No tenant, nothing to read.
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return [];
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Use Knex for advanced filtering with joins
				const knex = (this.mikroOrmRepository as any).getKnex();
				let qb = knex('plugin_billing as billing')
					.leftJoin('plugin_subscription as subscription', 'billing.subscriptionId', 'subscription.id')
					.where('billing.tenantId', tenantId);

				if (options.subscriptionId) {
					qb = qb.andWhere('billing.subscriptionId', options.subscriptionId);
				}
				if (options.status) {
					qb = qb.andWhere('billing.status', options.status);
				}
				if (options.billingPeriod) {
					qb = qb.andWhere('billing.billingPeriod', options.billingPeriod);
				}
				if (options.currency) {
					qb = qb.andWhere('billing.currency', options.currency);
				}
				if (options.dateRange) {
					qb = qb.whereBetween('billing.billingDate', [options.dateRange.start, options.dateRange.end]);
				}
				if (options.amountRange) {
					qb = qb.whereBetween('billing.totalAmount', [options.amountRange.min, options.amountRange.max]);
				}

				return await qb.select('billing.*').orderBy('billing.billingDate', 'desc');
			}
			case MultiORMEnum.TypeORM:
			default: {
				const queryBuilder = this.typeOrmPluginBillingRepository
					.createQueryBuilder('billing')
					.leftJoinAndSelect('billing.subscription', 'subscription')
					.where('billing.tenantId = :tenantId', { tenantId });

				// Apply filters
				if (options.subscriptionId) {
					queryBuilder.andWhere('billing.subscriptionId = :subscriptionId', {
						subscriptionId: options.subscriptionId
					});
				}

				if (options.status) {
					queryBuilder.andWhere('billing.status = :status', { status: options.status });
				}

				if (options.billingPeriod) {
					queryBuilder.andWhere('billing.billingPeriod = :billingPeriod', {
						billingPeriod: options.billingPeriod
					});
				}

				if (options.currency) {
					queryBuilder.andWhere('billing.currency = :currency', { currency: options.currency });
				}

				if (options.dateRange) {
					queryBuilder.andWhere('billing.billingDate BETWEEN :startDate AND :endDate', {
						startDate: options.dateRange.start,
						endDate: options.dateRange.end
					});
				}

				if (options.amountRange) {
					queryBuilder.andWhere('billing.totalAmount BETWEEN :minAmount AND :maxAmount', {
						minAmount: options.amountRange.min,
						maxAmount: options.amountRange.max
					});
				}

				return await queryBuilder.orderBy('billing.billingDate', 'DESC').getMany();
			}
		}
	}

	/**
	 * Get billing summary for a subscription
	 */
	async getBillingSummary(subscriptionId: string): Promise<IPluginBillingSummary> {
		// The caller's tenant only (see findBillings); no tenant, an empty summary
		const tenantId = RequestContext.currentTenantId();
		const billings = !tenantId
			? []
			: await this.typeOrmPluginBillingRepository.find({
					where: { subscriptionId, tenantId },
					order: { billingDate: 'DESC' }
				});

		const summary: IPluginBillingSummary = {
			subscriptionId,
			totalBillings: billings.length,
			totalAmount: 0,
			paidAmount: 0,
			pendingAmount: 0,
			overdueAmount: 0,
			currency: billings[0]?.currency || 'USD'
		};

		billings.forEach((billing) => {
			summary.totalAmount += billing.amount;

			switch (billing.status) {
				case PluginBillingStatus.PAID:
				case PluginBillingStatus.PARTIALLY_PAID:
					summary.paidAmount += billing.amount;
					break;
				case PluginBillingStatus.PENDING:
				case PluginBillingStatus.PROCESSED:
					summary.pendingAmount += billing.amount;
					break;
				case PluginBillingStatus.OVERDUE:
					summary.overdueAmount += billing.amount;
					break;
			}
		});

		// Get latest billing date
		if (billings.length > 0) {
			summary.lastBillingDate = billings[0].billingDate;
		}

		return summary;
	}

	/**
	 * Get overdue billings
	 */
	async getOverdueBillings(): Promise<IPluginBilling[]> {
		// The caller's tenant only (see findBillings); no tenant, nothing overdue
		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			return [];
		}
		const now = new Date();
		return await this.typeOrmPluginBillingRepository.find({
			where: {
				tenantId,
				status: PluginBillingStatus.PENDING,
				dueDate: LessThan(now)
			},
			relations: parseFindOptionsRelations(['subscription']),
			order: { dueDate: 'ASC' }
		});
	}

	/**
	 * Mark billing as paid
	 */
	async markAsPaid(id: string, paymentReference?: string): Promise<PluginBilling | UpdateResult> {
		const updateData: Partial<IPluginBilling> = {
			status: PluginBillingStatus.PAID
		};

		// Add payment reference to metadata if provided
		if (paymentReference) {
			const billing = await this.findOneByIdString(id);
			updateData.metadata = {
				...billing?.metadata,
				paymentReference
			};
		}

		return this.update(id, updateData);
	}

	/**
	 * Mark billing as failed
	 */
	async markAsFailed(id: string, reason?: string): Promise<PluginBilling | UpdateResult> {
		const billing = await this.findOneByIdString(id);
		if (!billing) {
			throw new Error(`Billing record with ID '${id}' not found`);
		}

		const updateData = {
			status: PluginBillingStatus.FAILED,
			metadata: reason ? { ...billing.metadata, failureReason: reason } : billing.metadata
		};

		return this.update(id, updateData);
	}

	/*
	 * Writes of the plugin's publisher and of the installation's operator, who write the bills of every tenant: the
	 * reads and writes below are not scoped to the caller's tenant. Only for a caller checked by
	 * `resolveBillingWriteAccess` (`plugin-billing-write-access.ts`).
	 */

	/**
	 * The subscription a bill route names, in whichever tenant holds it.
	 *
	 * @param subscriptionId - The subscription.
	 */
	async findSubscriptionInAnyTenant(subscriptionId: ID): Promise<PluginSubscription | null> {
		return this.typeOrmPluginBillingRepository.manager.findOne(PluginSubscription, {
			where: { id: subscriptionId }
		});
	}

	/**
	 * A bill by id, in whichever tenant holds it.
	 *
	 * @param id - The bill.
	 */
	async findOneInAnyTenant(id: ID): Promise<PluginBilling | null> {
		return this.typeOrmPluginBillingRepository.findOne({ where: { id } });
	}

	/**
	 * Files a bill under a subscription, in the subscription's tenant and organization rather than the caller's.
	 *
	 * @param input - The bill.
	 * @param subscription - The subscription it bills.
	 */
	async createForSubscription(
		input: IPluginBillingCreateInput,
		subscription: Pick<IPluginSubscription, 'id' | 'tenantId' | 'organizationId'>
	): Promise<PluginBilling> {
		return this.saveWithoutEnrichment({
			...input,
			subscriptionId: subscription.id,
			tenantId: subscription.tenantId,
			organizationId: subscription.organizationId
		});
	}

	/**
	 * Writes to a bill in whichever tenant holds it; its tenant, organization and subscription stay as stored.
	 *
	 * A body with nothing to write (`{}`, or only members the validation pipe stripped) changes nothing, as the
	 * tenant-scoped `update` answers it: TypeORM refuses an `UPDATE` without values (`UpdateValuesMissingError`).
	 *
	 * @param id - The bill.
	 * @param input - The fields to write.
	 */
	async updateInAnyTenant(id: ID, input: IPluginBillingUpdateInput): Promise<void> {
		if (!Object.values(input ?? {}).some((value) => value !== undefined)) {
			return;
		}
		await this.typeOrmPluginBillingRepository.update({ id }, input as Partial<PluginBilling>);
	}

	/**
	 * Marks a bill read with {@link findOneInAnyTenant} paid, as {@link markAsPaid} does in the caller's tenant.
	 *
	 * @param billing - The bill.
	 * @param paymentReference - The payment's reference, kept in the bill's metadata.
	 */
	async markAsPaidInAnyTenant(billing: IPluginBilling, paymentReference?: string): Promise<void> {
		await this.updateInAnyTenant(billing.id, {
			status: PluginBillingStatus.PAID,
			...(paymentReference && { metadata: { ...billing.metadata, paymentReference } })
		});
	}

	/**
	 * Marks a bill read with {@link findOneInAnyTenant} failed, as {@link markAsFailed} does in the caller's tenant.
	 *
	 * @param billing - The bill.
	 * @param reason - Why the payment failed, kept in the bill's metadata.
	 */
	async markAsFailedInAnyTenant(billing: IPluginBilling, reason?: string): Promise<void> {
		await this.updateInAnyTenant(billing.id, {
			status: PluginBillingStatus.FAILED,
			metadata: reason ? { ...billing.metadata, failureReason: reason } : billing.metadata
		});
	}

	/**
	 * Generate invoice number
	 */
	async generateInvoiceNumber(): Promise<string> {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, '0');

		// Get count of billings this month to generate sequence number
		const startOfMonth = new Date(year, now.getMonth(), 1);
		const endOfMonth = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

		const monthlyCount = await this.typeOrmPluginBillingRepository.count({
			where: {
				createdAt: Between(startOfMonth, endOfMonth)
			}
		});

		const sequence = String(monthlyCount + 1).padStart(4, '0');
		return `INV-${year}${month}-${sequence}`;
	}
}
