import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { TenantAwareCrudService } from '@gauzy/core';
import { PluginBilling } from '../entities/plugin-billing.entity';
import {
	IPluginBilling,
	IPluginBillingCreateInput,
	IPluginBillingUpdateInput,
	IPluginBillingFindInput,
	IPluginBillingSummary,
	PluginBillingStatus
} from '../../shared/models/plugin-billing.model';

@Injectable()
export class PluginBillingService extends TenantAwareCrudService<PluginBilling> {
	constructor(
		@InjectRepository(PluginBilling)
		private readonly typeOrmPluginBillingRepository: Repository<PluginBilling>
	) {
		super(typeOrmPluginBillingRepository, null);
	}

	/**
	 * Create billing record and calculate total amount
	 */
	async create(input: IPluginBillingCreateInput): Promise<IPluginBilling> {
		// Calculate total amount
		const totalAmount = this.calculateTotalAmount(input.amount, input.taxAmount || 0, input.discountAmount || 0);

		const billingData = {
			...input,
			totalAmount,
			retryCount: 0
		};

		return await super.create(billingData);
	}

	/**
	 * Update billing record and recalculate total if necessary
	 */
	async update(id: string, input: IPluginBillingUpdateInput): Promise<IPluginBilling> {
		const existing = await this.findOneByIdString(id);
		if (!existing) {
			throw new Error(`Billing record with ID '${id}' not found`);
		}

		// Recalculate total if amount-related fields changed
		let totalAmount = existing.totalAmount;
		if (input.amount !== undefined || input.taxAmount !== undefined || input.discountAmount !== undefined) {
			totalAmount = this.calculateTotalAmount(
				input.amount ?? existing.amount,
				input.taxAmount ?? existing.taxAmount ?? 0,
				input.discountAmount ?? existing.discountAmount ?? 0
			);
		}

		const updateData = {
			...input,
			...(totalAmount !== existing.totalAmount && { totalAmount })
		};

		return super.update(id, updateData);
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
			summary.totalAmount += billing.totalAmount;

			switch (billing.status) {
				case PluginBillingStatus.PAID:
				case PluginBillingStatus.PARTIALLY_PAID:
					summary.paidAmount += billing.totalAmount;
					break;
				case PluginBillingStatus.PENDING:
				case PluginBillingStatus.PROCESSED:
					summary.pendingAmount += billing.totalAmount;
					break;
				case PluginBillingStatus.OVERDUE:
					summary.overdueAmount += billing.totalAmount;
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
	async markAsPaid(id: string, paymentReference?: string): Promise<IPluginBilling> {
		return await this.update(id, {
			status: PluginBillingStatus.PAID,
			paymentReference
		});
	}

	/**
	 * Mark billing as failed and handle retry logic
	 */
	async markAsFailed(id: string, reason?: string): Promise<IPluginBilling> {
		const billing = await this.findOneByIdString(id);
		if (!billing) {
			throw new Error(`Billing record with ID '${id}' not found`);
		}

		const retryCount = (billing.retryCount || 0) + 1;
		const nextRetryAt = this.calculateNextRetryDate(retryCount);

		return await this.update(id, {
			status: PluginBillingStatus.FAILED,
			retryCount,
			lastRetryAt: new Date(),
			nextRetryAt,
			metadata: reason ? JSON.stringify({ failureReason: reason }) : billing.metadata
		});
	}

	/**
	 * Calculate total amount including tax and discount
	 */
	private calculateTotalAmount(amount: number, taxAmount: number, discountAmount: number): number {
		return Math.max(0, amount + taxAmount - discountAmount);
	}

	/**
	 * Calculate next retry date based on retry count
	 */
	private calculateNextRetryDate(retryCount: number): Date {
		const now = new Date();
		const delays = [1, 3, 6, 24, 72]; // hours
		const delayHours = delays[Math.min(retryCount - 1, delays.length - 1)];

		return new Date(now.getTime() + delayHours * 60 * 60 * 1000);
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
