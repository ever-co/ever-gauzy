import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { PaymentSchema, PaymentStatusEnum, PaymentMethodEnum, CurrenciesEnum } from '../schema';

const logger = new Logger('PaymentTools');

/**
 * Helper function to validate organization context and return default parameters
 */
const validateOrganizationContext = () => {
	const defaultParams = authManager.getDefaultParams();

	if (!defaultParams.organizationId) {
		throw new Error('Organization ID not available. Please ensure you are logged in and have an organization.');
	}

	return defaultParams;
};

/**
 * Helper function to convert date fields in payment data to Date objects
 */
const convertPaymentDateFields = (paymentData: any) => {
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
				logger.error('Error fetching payments:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch payments: ${message}`);
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
				logger.error('Error fetching payment count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch payment count: ${message}`);
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
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/payments/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching payment:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch payment: ${message}`);
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
				logger.error('Error creating payment:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create payment: ${message}`);
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
				logger.error('Error updating payment:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update payment: ${message}`);
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
				logger.error('Error updating payment status:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update payment status: ${message}`);
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
				logger.error('Error deleting payment:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete payment: ${message}`);
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
				logger.error('Error fetching payments by invoice:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch payments by invoice: ${message}`);
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
				logger.error('Error fetching payments by client:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch payments by client: ${message}`);
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
				logger.error('Error fetching payment statistics:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch payment statistics: ${message}`);
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
				logger.error('Error processing payment:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to process payment: ${message}`);
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
				logger.error('Error refunding payment:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to refund payment: ${message}`);
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
				logger.error('Error fetching overdue payments:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch overdue payments: ${message}`);
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
				logger.error('Error searching payments:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search payments: ${message}`);
			}
		}
	);
};