import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { InvoiceSchema, InvoiceStatusEnum, InvoiceTypeEnum, CurrenciesEnum } from '../schema';

const logger = new Logger('InvoiceTools');

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
 * Helper function to convert date fields in invoice data to Date objects
 */
const convertInvoiceDateFields = (invoiceData: any) => {
	return {
		...invoiceData,
		invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : undefined,
		dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined
	};
};

export const registerInvoiceTools = (server: McpServer) => {
	// Get invoices tool
	server.tool(
		'get_invoices',
		"Get list of invoices for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for invoice number or client name'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["organizationContact", "invoiceItems", "tags"])'),
			status: InvoiceStatusEnum.optional().describe('Filter by invoice status'),
			invoiceType: InvoiceTypeEnum.optional().describe('Filter by invoice type'),
			paid: z.boolean().optional().describe('Filter by payment status'),
			startDate: z.string().optional().describe('Filter invoices from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter invoices until this date (ISO format)')
		},
		async ({ page = 1, limit = 10, search, relations, status, invoiceType, paid, startDate, endDate }) => {
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
					...(invoiceType && { invoiceType }),
					...(paid !== undefined && { paid }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/invoices', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching invoices:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch invoices: ${message}`);
			}
		}
	);

	// Get invoice count tool
	server.tool(
		'get_invoice_count',
		"Get invoice count in the authenticated user's organization",
		{
			status: InvoiceStatusEnum.optional().describe('Filter by invoice status'),
			paid: z.boolean().optional().describe('Filter by payment status'),
			startDate: z.string().optional().describe('Filter invoices from this date (ISO format)'),
			endDate: z.string().optional().describe('Filter invoices until this date (ISO format)')
		},
		async ({ status, paid, startDate, endDate }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(status && { status }),
					...(paid !== undefined && { paid }),
					...(startDate && { startDate }),
					...(endDate && { endDate })
				};

				const response = await apiClient.get('/api/invoices/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching invoice count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch invoice count: ${message}`);
			}
		}
	);

	// Get invoice by ID tool
	server.tool(
		'get_invoice',
		'Get a specific invoice by ID',
		{
			id: z.string().uuid().describe('The invoice ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["organizationContact", "invoiceItems", "tags"])')
		},
		async ({ id, relations }) => {
			try {
				const params = {
					...(relations && { relations })
				};

				const response = await apiClient.get(`/api/invoices/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching invoice:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch invoice: ${message}`);
			}
		}
	);

	// Create invoice tool
	server.tool(
		'create_invoice',
		"Create a new invoice in the authenticated user's organization",
		{
			invoice_data: InvoiceSchema.partial()
				.required({
					invoiceNumber: true,
					invoiceDate: true,
					dueDate: true,
					currency: true
				})
				.describe('The data for creating the invoice')
		},
		async ({ invoice_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertInvoiceDateFields({
					...invoice_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/invoices', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating invoice:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create invoice: ${message}`);
			}
		}
	);

	// Update invoice tool
	server.tool(
		'update_invoice',
		'Update an existing invoice',
		{
			id: z.string().uuid().describe('The invoice ID'),
			invoice_data: InvoiceSchema.partial().describe('The data for updating the invoice')
		},
		async ({ id, invoice_data }) => {
			try {
				const updateData = convertInvoiceDateFields(invoice_data);

				const response = await apiClient.put(`/api/invoices/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating invoice:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update invoice: ${message}`);
			}
		}
	);

	// Update invoice status tool
	server.tool(
		'update_invoice_status',
		'Update the status of an invoice',
		{
			id: z.string().uuid().describe('The invoice ID'),
			status: InvoiceStatusEnum.describe('The new status for the invoice')
		},
		async ({ id, status }) => {
			try {
				const response = await apiClient.put(`/api/invoices/${id}/status`, { status });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating invoice status:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update invoice status: ${message}`);
			}
		}
	);

	// Mark invoice as paid tool
	server.tool(
		'mark_invoice_paid',
		'Mark an invoice as paid',
		{
			id: z.string().uuid().describe('The invoice ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/invoices/${id}/paid`, { paid: true });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error marking invoice as paid:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to mark invoice as paid: ${message}`);
			}
		}
	);

	// Delete invoice tool
	server.tool(
		'delete_invoice',
		'Delete an invoice',
		{
			id: z.string().uuid().describe('The invoice ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/invoices/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{ success: true, message: 'Invoice deleted successfully', id },
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting invoice:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete invoice: ${message}`);
			}
		}
	);

	// Get invoice items tool
	server.tool(
		'get_invoice_items',
		'Get items for a specific invoice',
		{
			invoiceId: z.string().uuid().describe('The invoice ID'),
			relations: z
				.array(z.string())
				.optional()
				.describe('Relations to include (e.g., ["product", "project", "task"])')
		},
		async ({ invoiceId, relations }) => {
			try {
				const params = {
					invoiceId,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/invoice-items', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching invoice items:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch invoice items: ${message}`);
			}
		}
	);

	// Send invoice tool
	server.tool(
		'send_invoice',
		'Send an invoice via email',
		{
			id: z.string().uuid().describe('The invoice ID'),
			email: z.string().email().describe('Email address to send the invoice to')
		},
		async ({ id, email }) => {
			try {
				const response = await apiClient.post(`/api/invoices/${id}/send`, { email });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error sending invoice:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to send invoice: ${message}`);
			}
		}
	);

	// Generate invoice PDF tool
	server.tool(
		'generate_invoice_pdf',
		'Generate PDF for an invoice',
		{
			id: z.string().uuid().describe('The invoice ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.get<Blob>(`/api/invoices/${id}/pdf`, { responseType: 'blob' });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									success: true,
									message: 'Invoice PDF generated successfully',
									id,
									pdfSize: response.size || 'Unknown'
								},
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error generating invoice PDF:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to generate invoice PDF: ${message}`);
			}
		}
	);

	// Get invoice statistics tool
	server.tool(
		'get_invoice_statistics',
		"Get invoice statistics for the authenticated user's organization",
		{
			startDate: z.string().optional().describe('Start date for statistics (ISO format)'),
			endDate: z.string().optional().describe('End date for statistics (ISO format)'),
			organizationContactId: z.string().uuid().optional().describe('Filter by specific client ID')
		},
		async ({ startDate, endDate, organizationContactId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(startDate && { startDate }),
					...(endDate && { endDate }),
					...(organizationContactId && { organizationContactId })
				};

				const response = await apiClient.get('/api/invoices/statistics', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching invoice statistics:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch invoice statistics: ${message}`);
			}
		}
	);

	// Search invoices tool
	server.tool(
		'search_invoices',
		'Search invoices by invoice number, client name, or items',
		{
			query: z.string().describe('Search query'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			status: InvoiceStatusEnum.optional().describe('Filter by invoice status'),
			paid: z.boolean().optional().describe('Filter by payment status')
		},
		async ({ query, limit = 20, status, paid }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					limit,
					...(status && { status }),
					...(paid !== undefined && { paid })
				};

				const response = await apiClient.get('/api/invoices/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching invoices:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search invoices: ${message}`);
			}
		}
	);

	// Get overdue invoices tool
	server.tool(
		'get_overdue_invoices',
		"Get overdue invoices for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			relations: z.array(z.string()).optional().describe('Relations to include')
		},
		async ({ page = 1, limit = 10, relations }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(relations && { relations })
				};

				const response = await apiClient.get('/api/invoices/overdue', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching overdue invoices:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch overdue invoices: ${message}`);
			}
		}
	);
};
