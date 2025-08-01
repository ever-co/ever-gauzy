import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { ProductCategorySchema } from '../schema';

const logger = new Logger('ProductCategoryTools');

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
				logger.error('Error fetching product categories:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch product categories: ${message}`);
			}
		}
	);

	// Get product categories with translations tool
	server.tool(
		'get_product_categories_translated',
		"Get list of product categories with translations for the authenticated user's organization",
		{
			langCode: z.string().describe('Language code for translations (e.g., "en", "fr", "es")'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for category name or description')
		},
		async ({ langCode, page = 1, limit = 10, search }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					langCode,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search })
				};

				const response = await apiClient.get('/api/product-categories/translated', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching translated product categories:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch translated product categories: ${message}`);
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
				logger.error('Error fetching product category count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch product category count: ${message}`);
			}
		}
	);

	// Get product category by ID tool
	server.tool(
		'get_product_category',
		'Get a specific product category by ID',
		{
			id: z.string().uuid().describe('The product category ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["products", "image"])'),
			langCode: z.string().optional().describe('Language code for translations')
		},
		async ({ id, relations, langCode }) => {
			try {
				const params = {
					...(relations && { relations }),
					...(langCode && { langCode })
				};

				const response = await apiClient.get(`/api/product-categories/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching product category:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch product category: ${message}`);
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
				logger.error('Error creating product category:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create product category: ${message}`);
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
				logger.error('Error updating product category:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update product category: ${message}`);
			}
		}
	);

	// Delete product category tool
	server.tool(
		'delete_product_category',
		'Delete a product category',
		{
			id: z.string().uuid().describe('The product category ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/product-categories/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Product category deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting product category:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete product category: ${message}`);
			}
		}
	);

	// Create product category with translations tool
	server.tool(
		'create_product_category_with_translations',
		"Create a new product category with multiple language translations",
		{
			category_data: z.object({
				name: z.string().describe('Category name (required)'),
				description: z.string().optional().describe('Category description'),
				imageUrl: z.string().optional().describe('Category image URL'),
				translations: z.array(z.object({
					languageCode: z.string().describe('Language code (e.g., "en", "fr", "es")'),
					name: z.string().describe('Category name in this language'),
					description: z.string().optional().describe('Category description in this language')
				})).min(1).describe('Category translations (at least one required)')
			}).describe('Category data with translations')
		},
		async ({ category_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...category_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/product-categories/create-with-translations', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating product category with translations:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create product category with translations: ${message}`);
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
				logger.error('Error fetching products by category:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch products by category: ${message}`);
			}
		}
	);

	// Search product categories tool
	server.tool(
		'search_product_categories',
		'Search product categories by name or description',
		{
			query: z.string().describe('Search query'),
			langCode: z.string().optional().describe('Language code for translations'),
			limit: z.number().optional().default(20).describe('Maximum number of results')
		},
		async ({ query, langCode, limit = 20 }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(langCode && { langCode }),
					limit
				};

				const response = await apiClient.get('/api/product-categories/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching product categories:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search product categories: ${message}`);
			}
		}
	);
};