import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { InvoiceSchema, InvoiceStatusEnum, InvoiceTypeEnum, CurrenciesEnum } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('InvoiceTools');


/**
 * Helper function to convert date fields in invoice data to Date objects
 */
interface InvoiceData {
	invoiceDate?: string | Date;
	dueDate?: string | Date;
	[key: string]: any; // Allow other properties since we spread them
}

interface ConvertedInvoiceData extends Omit<InvoiceData, 'invoiceDate' | 'dueDate'> {
	invoiceDate?: Date;
	dueDate?: Date;
}

const convertInvoiceDateFields = (invoiceData: InvoiceData): ConvertedInvoiceData => {
	return {
		...invoiceData,
		invoiceDate: invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate) : undefined,
		dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined
	};
};

export const registerInvoiceTools = (server: McpServer) => {
	// Get invoices tool - uses pagination endpoint
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

				const response = await apiClient.get('/api/invoices/pagination', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching invoices:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch invoices: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error fetching invoice count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch invoice count: ${sanitizeErrorMessage(error)}`);
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
					data: JSON.stringify({
						relations: relations || [],
						findInput: null
					})
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
				logger.error('Error fetching invoice:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch invoice: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error creating invoice:', sanitizeForLogging(error));
				throw new Error(`Failed to create invoice: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error updating invoice:', sanitizeForLogging(error));
				throw new Error(`Failed to update invoice: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update invoice action (status/estimate) tool
	server.tool(
		'update_invoice_action',
		'Update the action/status of an invoice',
		{
			id: z.string().uuid().describe('The invoice ID'),
			status: InvoiceStatusEnum.optional().describe('The new status for the invoice'),
			isEstimate: z.boolean().optional().describe('Whether this is an estimate')
		},
		async ({ id, status, isEstimate }) => {
			try {
				const updateData = {
					...(status && { status }),
					...(isEstimate !== undefined && { isEstimate })
				};

				const response = await apiClient.put(`/api/invoices/${id}/action`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating invoice action:', sanitizeForLogging(error));
				throw new Error(`Failed to update invoice action: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update estimate status tool
	server.tool(
		'update_estimate_status',
		'Update estimate status of an invoice',
		{
			id: z.string().uuid().describe('The invoice ID'),
			data: z.object({
				isEstimate: z.boolean().optional(),
				status: InvoiceStatusEnum.optional(),
				paid: z.boolean().optional()
			}).describe('Data to update for the estimate')
		},
		async ({ id, data }) => {
			try {
				const response = await apiClient.put(`/api/invoices/${id}/estimate`, data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating estimate status:', sanitizeForLogging(error));
				throw new Error(`Failed to update estimate status: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error deleting invoice:', sanitizeForLogging(error));
				throw new Error(`Failed to delete invoice: ${sanitizeErrorMessage(error)}`);
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
				const queryParams = {
					data: JSON.stringify({
						relations: relations || [],
						findInput: { invoiceId }
					})
				};

				const response = await apiClient.get('/api/invoice-item', { params: queryParams });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching invoice items:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch invoice items: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Send invoice via email tool
	server.tool(
		'send_invoice_email',
		'Send an invoice via email',
		{
			email: z.string().email().describe('Email address to send the invoice to'),
			params: z.object({
				invoiceId: z.string().uuid(),
				organizationId: z.string().uuid().optional(),
				tenantId: z.string().uuid().optional()
			}).describe('Email parameters including invoice ID')
		},
		async ({ email, params }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const emailData = {
					params: {
						...params,
						organizationId: params.organizationId || defaultParams.organizationId,
						...(defaultParams.tenantId && { tenantId: params.tenantId || defaultParams.tenantId })
					}
				};

				const response = await apiClient.put(`/api/invoices/email/${email}`, emailData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error sending invoice email:', sanitizeForLogging(error));
				throw new Error(`Failed to send invoice email: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Generate invoice PDF tool
	server.tool(
		'download_invoice_pdf',
		'Download PDF for an invoice as binary data',
		{
			id: z.string().uuid().describe('The invoice ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.get(`/api/invoices/download/${id}`, { responseType: 'arraybuffer' });

				// Convert to Base64 for transport
				const buffer = Buffer.from(response as unknown as string);
				const base64Content = buffer.toString('base64');

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									success: true,
									message: 'Invoice PDF downloaded successfully',
									id,
									pdfSize: buffer.length,
									mimeType: 'application/pdf',
									filename: `invoice-${id}.pdf`,
									pdfContent: base64Content
								},
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error downloading invoice PDF:', sanitizeForLogging(error));
				throw new Error(`Failed to download invoice PDF: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get highest invoice number tool
	server.tool(
		'get_highest_invoice_number',
		'Get the highest invoice number in the organization',
		{},
		async () => {
			try {
				const response = await apiClient.get('/api/invoices/highest');

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching highest invoice number:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch highest invoice number: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Generate public link for invoice tool
	server.tool(
		'generate_invoice_link',
		'Generate a public link for an invoice',
		{
			id: z.string().uuid().describe('The invoice ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.put(`/api/invoices/generate/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error generating invoice link:', sanitizeForLogging(error));
				throw new Error(`Failed to generate invoice link: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Download invoice payment PDF tool
	server.tool(
		'download_invoice_payment_pdf',
		'Download payment PDF for an invoice',
		{
			id: z.string().uuid().describe('The invoice ID')
		},
		async ({ id }) => {
			try {
				const response = await apiClient.get(`/api/invoices/payment/download/${id}`, { responseType: 'arraybuffer' });

				// Convert to Base64 for transport
				const buffer = Buffer.from(response as unknown as string);
				const base64Content = buffer.toString('base64');

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									success: true,
									message: 'Invoice payment PDF downloaded successfully',
									id,
									pdfSize: buffer.length,
									mimeType: 'application/pdf',
									filename: `invoice-payment-${id}.pdf`,
									pdfContent: base64Content
								},
								null,
								2
							)
						}
					]
				};
			} catch (error) {
				logger.error('Error downloading invoice payment PDF:', sanitizeForLogging(error));
				throw new Error(`Failed to download invoice payment PDF: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};
