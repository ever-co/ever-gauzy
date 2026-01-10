import { PluginBillingStatus } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { Between, LessThan, UpdateResult } from 'typeorm';
import {
	IPluginBilling,
	IPluginBillingCreateInput,
	IPluginBillingFindInput,
	IPluginBillingSummary,
	IPluginBillingUpdateInput
} from '../../shared/models/plugin-billing.model';
import { PluginBilling } from '../entities/plugin-billing.entity';
import { MikroOrmPluginBillingRepository, TypeOrmPluginBillingRepository } from '../repositories';

@Injectable()
export class PluginBillingService extends TenantAwareCrudService<PluginBilling> {
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
		const queryBuilder = this.typeOrmPluginBillingRepository
			.createQueryBuilder('billing')
			.leftJoinAndSelect('billing.subscription', 'subscription');

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

	/**
	 * Get billing summary for a subscription
	 */
	async getBillingSummary(subscriptionId: string): Promise<IPluginBillingSummary> {
		const billings = await this.typeOrmPluginBillingRepository.find({
			where: { subscriptionId },
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
		const now = new Date();
		return await this.typeOrmPluginBillingRepository.find({
			where: {
				status: PluginBillingStatus.PENDING,
				dueDate: LessThan(now)
			},
			relations: ['subscription'],
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
