import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { ProductCategorySchema } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('ProductCategoryTools');


export const registerProductCategoryTools = (server: McpServer) => {
	// Get product categories tool
	server.tool(
		'get_product_categories',
		"Get list of product categories for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for category name'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["products", "image"])'),
			langCode: z.string().optional().describe('Language code for translations')
		},
		async ({ page = 1, limit = 10, search, relations, langCode }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(langCode && { langCode })
				};

				const response = await apiClient.get('/api/product-categories', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching product categories:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch product categories: ${sanitizeErrorMessage(error)}`);
			}
		}
	);


	// Get product category count tool
	server.tool(
		'get_product_category_count',
		"Get product category count in the authenticated user's organization",
		{},
		async () => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.get('/api/product-categories/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching product category count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch product category count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);


	// Create product category tool
	server.tool(
		'create_product_category',
		"Create a new product category in the authenticated user's organization",
		{
			category_data: ProductCategorySchema.partial()
				.required({
					name: true
				})
				.extend({
					translations: z.array(z.object({
						languageCode: z.string(),
						name: z.string(),
						description: z.string().optional()
					})).optional().describe('Category translations for different languages')
				})
				.describe('The data for creating the product category')
		},
		async ({ category_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...category_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/product-categories', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating product category:', sanitizeForLogging(error));
				throw new Error(`Failed to create product category: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update product category tool
	server.tool(
		'update_product_category',
		'Update an existing product category',
		{
			id: z.string().uuid().describe('The product category ID'),
			category_data: ProductCategorySchema.partial()
				.extend({
					translations: z.array(z.object({
						languageCode: z.string(),
						name: z.string(),
						description: z.string().optional()
					})).optional().describe('Category translations for different languages')
				})
				.describe('The data for updating the product category')
		},
		async ({ id, category_data }) => {
			try {
				const response = await apiClient.put(`/api/product-categories/${id}`, category_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating product category:', sanitizeForLogging(error));
				throw new Error(`Failed to update product category: ${sanitizeErrorMessage(error)}`);
			}
		}
	);



	// Get products by category tool
	server.tool(
		'get_products_by_category',
		'Get all products in a specific category',
		{
			categoryId: z.string().uuid().describe('The product category ID'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			enabled: z.boolean().optional().describe('Filter by enabled status'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			langCode: z.string().optional().describe('Language code for translations')
		},
		async ({ categoryId, page = 1, limit = 10, enabled, relations, langCode }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					productCategoryId: categoryId,
					page,
					limit,
					...(enabled !== undefined && { enabled }),
					...(relations && { relations }),
					...(langCode && { langCode })
				};

				const response = await apiClient.get('/api/products', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching products by category:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch products by category: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

};