import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { PaymentSchema, PaymentStatusEnum, PaymentMethodEnum, CurrenciesEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('PaymentTools');


/**
 * Helper function to convert date fields in payment data to Date objects
 */
interface PaymentData {
	paymentDate?: string | Date;
	[key: string]: any; // Allow other properties since we spread them
}

interface ConvertedPaymentData extends Omit<PaymentData, 'paymentDate'> {
	paymentDate?: Date;
}

const convertPaymentDateFields = (paymentData: PaymentData): ConvertedPaymentData => {
	return {
		...paymentData,
		paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : undefined
	};
};

export const registerPaymentTools = (server: McpServer) => {
	// Get payments tool
	server.tool(
		'get_payments',
		"Get list of payments for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for payment notes'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["invoice", "organizationContact", "project", "recordedBy"])'),
			status: PaymentStatusEnum.optional().describe('Filter by payment status'),
			paymentMethod: PaymentMethodEnum.optional().describe('Filter by payment method'),
			invoiceId: z.string().uuid().optional().describe('Filter by invoice ID'),
			organizationContactId: z.string().uuid().optional().describe('Filter by organization contact ID'),
			projectId: z.string().uuid().optional().describe('Filter by project ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			startDate: z.string().optional().describe('Filter payments from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter payments until this date (ISO format)'),
			overdue: z.boolean().optional().describe('Filter by overdue status')
		},
		async ({ page = 1, limit = 10, search, relations, status, paymentMethod, invoiceId, organizationContactId, projectId, currency, startDate, endDate, overdue }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(status && { status }),
					...(paymentMethod && { paymentMethod }),
					...(invoiceId && { invoiceId }),
					...(organizationContactId && { organizationContactId }),
					...(projectId && { projectId }),
					...(currency && { currency }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(overdue !== undefined && { overdue })
				};

				const response = await apiClient.get('/api/payments', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching payments:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch payments: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get payment count tool
	server.tool(
		'get_payment_count',
		"Get payment count in the authenticated user's organization",
		{
			status: PaymentStatusEnum.optional().describe('Filter by payment status'),
			paymentMethod: PaymentMethodEnum.optional().describe('Filter by payment method'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			overdue: z.boolean().optional().describe('Filter by overdue status'),
			startDate: z.string().optional().describe('Filter payments from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter payments until this date (ISO format)')
		},
		async ({ status, paymentMethod, currency, overdue, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(status && { status }),
					...(paymentMethod && { paymentMethod }),
					...(currency && { currency }),
					...(overdue !== undefined && { overdue }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/payments/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching payment count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch payment count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get payment by ID tool
	server.tool(
		'get_payment',
		'Get a specific payment by ID',
		{
			id: z.string().uuid().describe('The payment ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["invoice", "organizationContact", "project", "recordedBy"])')
		},
		async ({ id, relations }) => {
			try {
				// Validate organization context and get authenticated user's organization ID
				const defaultParams = validateOrganizationContext();

				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/payments/${id}`, { params });

				// Verify that the payment belongs to the authenticated user's organization
				if ((response as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Access denied: Payment does not belong to your organization');
				}

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching payment:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch payment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create payment tool
	server.tool(
		'create_payment',
		"Create a new payment in the authenticated user's organization",
		{
			payment_data: PaymentSchema.partial()
				.required({
					amount: true,
					currency: true
				})
				.describe('The data for creating the payment')
		},
		async ({ payment_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertPaymentDateFields({
					...payment_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/payments', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating payment:', sanitizeForLogging(error));
				throw new Error(`Failed to create payment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update payment tool
	server.tool(
		'update_payment',
		'Update an existing payment',
		{
			id: z.string().uuid().describe('The payment ID'),
			payment_data: PaymentSchema.partial().describe('The data for updating the payment')
		},
		async ({ id, payment_data }) => {
			try {
				// Validate organization context and get authenticated user's organization ID
				const defaultParams = validateOrganizationContext();

				// First, fetch the payment to verify ownership
				const existingPayment = await apiClient.get(`/api/payments/${id}`);

				// Verify that the payment belongs to the authenticated user's organization
				if ((existingPayment as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Access denied: Payment does not belong to your organization');
				}

				const updateData = convertPaymentDateFields(payment_data);

				const response = await apiClient.put(`/api/payments/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating payment:', sanitizeForLogging(error));
				throw new Error(`Failed to update payment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update payment status tool
	server.tool(
		'update_payment_status',
		'Update the status of a payment',
		{
			id: z.string().uuid().describe('The payment ID'),
			status: PaymentStatusEnum.describe('The new status for the payment')
		},
		async ({ id, status }) => {
			try {
				// Validate organization context and get authenticated user's organization ID
				const defaultParams = validateOrganizationContext();

				// First, fetch the payment to verify ownership
				const existingPayment = await apiClient.get(`/api/payments/${id}`);

				// Verify that the payment belongs to the authenticated user's organization
				if ((existingPayment as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Access denied: Payment does not belong to your organization');
				}

				const response = await apiClient.put(`/api/payments/${id}/status`, { status });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating payment status:', sanitizeForLogging(error));
				throw new Error(`Failed to update payment status: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete payment tool
	server.tool(
		'delete_payment',
		'Delete a payment',
		{
			id: z.string().uuid().describe('The payment ID')
		},
		async ({ id }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify payment ownership
				const existing = await apiClient.get(`/api/payments/${id}`);
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot delete payments from other organizations');
				}

				await apiClient.delete(`/api/payments/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Payment deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting payment:', sanitizeForLogging(error));
				throw new Error(`Failed to delete payment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get payments by invoice tool
	server.tool(
		'get_payments_by_invoice',
		'Get payments for a specific invoice',
		{
			invoiceId: z.string().uuid().describe('The invoice ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: PaymentStatusEnum.optional().describe('Filter by payment status'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ invoiceId, page = 1, limit = 10, status, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					invoiceId,
					page,
					limit,
					...(status && { status }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/payments', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching payments by invoice:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch payments by invoice: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get payments by client tool
	server.tool(
		'get_payments_by_client',
		'Get payments for a specific client/organization contact',
		{
			organizationContactId: z.string().uuid().describe('The organization contact ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			status: PaymentStatusEnum.optional().describe('Filter by payment status'),
			currency: CurrenciesEnum.optional().describe('Filter by currency'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ organizationContactId, page = 1, limit = 10, status, currency, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					organizationContactId,
					page,
					limit,
					...(status && { status }),
					...(currency && { currency }),
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/payments', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching payments by client:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch payments by client: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get payment statistics tool
	server.tool(
		'get_payment_statistics',
		"Get payment statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			organizationContactId: z.string().uuid().optional().describe('Filter by specific client ID'),
			projectId: z.string().uuid().optional().describe('Filter by specific project ID'),
			currency: CurrenciesEnum.optional().describe('Filter by currency')
		},
		async ({ startDate, endDate, organizationContactId, projectId, currency }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(organizationContactId && { organizationContactId }),
					...(projectId && { projectId }),
					...(currency && { currency })
				};

				const response = await apiClient.get('/api/payments/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching payment statistics:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch payment statistics: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Process payment tool
	server.tool(
		'process_payment',
		'Process a payment (mark as completed)',
		{
			id: z.string().uuid().describe('The payment ID'),
			paymentDate: z.string().optional().describe('The payment date (ISO format)')
		},
		async ({ id, paymentDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify payment ownership
				const existing = await apiClient.get(`/api/payments/${id}`);
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot process payments from other organizations');
				}

				const processData = {
					status: 'COMPLETED',
					...(paymentDate && { paymentDate: new Date(paymentDate) })
				};

				const response = await apiClient.put(`/api/payments/${id}/process`, processData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error processing payment:', sanitizeForLogging(error));
				throw new Error(`Failed to process payment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Refund payment tool
	server.tool(
		'refund_payment',
		'Refund a payment',
		{
			id: z.string().uuid().describe('The payment ID'),
			refundAmount: z.number().optional().describe('The refund amount (if partial refund)'),
			reason: z.string().optional().describe('Reason for refund')
		},
		async ({ id, refundAmount, reason }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Verify payment ownership
				const existing = await apiClient.get(`/api/payments/${id}`);
				if ((existing as { organizationId: string }).organizationId !== defaultParams.organizationId) {
					throw new Error('Unauthorized: Cannot refund payments from other organizations');
				}

				const refundData = {
					status: 'REFUNDED',
					...(refundAmount && { refundAmount }),
					...(reason && { refundReason: reason })
				};

				const response = await apiClient.put(`/api/payments/${id}/refund`, refundData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error refunding payment:', sanitizeForLogging(error));
				throw new Error(`Failed to refund payment: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get overdue payments tool
	server.tool(
		'get_overdue_payments',
		"Get overdue payments for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			currency: CurrenciesEnum.optional().describe('Filter by currency')
		},
		async ({ page = 1, limit = 10, relations, currency }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					overdue: true,
					...(relations && { relations }),
					...(currency && { currency })
				};

				const response = await apiClient.get('/api/payments/overdue', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching overdue payments:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch overdue payments: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Search payments tool
	server.tool(
		'search_payments',
		'Search payments by notes, invoice number, or client name',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			status: PaymentStatusEnum.optional().describe('Filter by payment status'),
			paymentMethod: PaymentMethodEnum.optional().describe('Filter by payment method'),
			currency: CurrenciesEnum.optional().describe('Filter by currency')
		},
		async ({ query, limit = 20, status, paymentMethod, currency }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(status && { status }),
					...(paymentMethod && { paymentMethod }),
					...(currency && { currency })
				};

				const response = await apiClient.get('/api/payments/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching payments:', sanitizeForLogging(error));
				throw new Error(`Failed to search payments: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};
