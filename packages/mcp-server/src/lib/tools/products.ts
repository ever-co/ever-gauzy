import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { ProductSchema, ProductTypeEnum } from '../schema';

const logger = new Logger('ProductTools');


/**
 * Interface for product data with date fields that need conversion
 */
interface ProductDataWithDates {
	[key: string]: any;
	createdAt?: string | Date | null;
	updatedAt?: string | Date | null;
}

/**
 * Helper function to convert date fields in product data to Date objects
 * @param productData - Product data that may contain date fields as strings
 * @returns Product data with date fields converted to Date objects
 */
const convertProductDateFields = <T extends ProductDataWithDates>(productData: T): T => {
	return {
		...productData,
		createdAt: productData.createdAt ? new Date(productData.createdAt) : undefined,
		updatedAt: productData.updatedAt ? new Date(productData.updatedAt) : undefined
	};
};

export const registerProductTools = (server: McpServer) => {
	// Get products tool
	server.tool(
		'get_products',
		"Get list of products for the authenticated user's organization",
		{
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for product name or code'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["productType", "productCategory", "tags"])'),
			enabled: z.boolean().optional().describe('Filter by enabled status'),
			productCategoryId: z.string().uuid().optional().describe('Filter by product category ID'),
			productTypeId: z.string().uuid().optional().describe('Filter by product type ID'),
			langCode: z.string().optional().describe('Language code for translations')
		},
		async ({ page = 1, limit = 10, search, relations, enabled, productCategoryId, productTypeId, langCode }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(enabled !== undefined && { enabled }),
					...(productCategoryId && { productCategoryId }),
					...(productTypeId && { productTypeId }),
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
				logger.error('Error fetching products:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch products: ${message}`);
			}
		}
	);

	// Get products with translations tool
	server.tool(
		'get_products_translated',
		"Get list of products with translations for the authenticated user's organization",
		{
			langCode: z.string().describe('Language code for translations (e.g., "en", "fr", "es")'),
			page: z.number().optional().default(1).describe('Page number for pagination'),
			limit: z.number().optional().default(10).describe('Number of items per page'),
			search: z.string().optional().describe('Search term for product name or description'),
			enabled: z.boolean().optional().describe('Filter by enabled status'),
			productCategoryId: z.string().uuid().optional().describe('Filter by product category ID')
		},
		async ({ langCode, page = 1, limit = 10, search, enabled, productCategoryId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					langCode,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					page,
					limit,
					...(search && { search }),
					...(enabled !== undefined && { enabled }),
					...(productCategoryId && { productCategoryId })
				};

				const response = await apiClient.get('/api/products/translated', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching translated products:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch translated products: ${message}`);
			}
		}
	);

	// Get product count tool
	server.tool(
		'get_product_count',
		"Get product count in the authenticated user's organization",
		{
			enabled: z.boolean().optional().describe('Filter by enabled status'),
			productCategoryId: z.string().uuid().optional().describe('Filter by product category ID'),
			productTypeId: z.string().uuid().optional().describe('Filter by product type ID')
		},
		async ({ enabled, productCategoryId, productTypeId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(enabled !== undefined && { enabled }),
					...(productCategoryId && { productCategoryId }),
					...(productTypeId && { productTypeId })
				};

				const response = await apiClient.get('/api/products/count', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ count: response }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching product count:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch product count: ${message}`);
			}
		}
	);

	// Get product by ID tool
	server.tool(
		'get_product',
		'Get a specific product by ID',
		{
			id: z.string().uuid().describe('The product ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["productType", "productCategory", "tags", "variants"])'),
			langCode: z.string().optional().describe('Language code for translations')
		},
		async ({ id, relations, langCode }) => {
			try {
				const params = {
					...(relations && { relations }),
					...(langCode && { langCode })
				};

				const response = await apiClient.get(`/api/products/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching product:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch product: ${message}`);
			}
		}
	);

	// Create product tool
	server.tool(
		'create_product',
		"Create a new product in the authenticated user's organization",
		{
			product_data: ProductSchema.partial()
				.required({
					code: true
				})
				.extend({
					translations: z.array(z.object({
						languageCode: z.string(),
						name: z.string(),
						description: z.string().optional()
					})).optional().describe('Product translations for different languages')
				})
				.describe('The data for creating the product')
		},
		async ({ product_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = convertProductDateFields({
					...product_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				});

				const response = await apiClient.post('/api/products', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating product:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create product: ${message}`);
			}
		}
	);

	// Update product tool
	server.tool(
		'update_product',
		'Update an existing product',
		{
			id: z.string().uuid().describe('The product ID'),
			product_data: ProductSchema.partial()
				.extend({
					translations: z.array(z.object({
						languageCode: z.string(),
						name: z.string(),
						description: z.string().optional()
					})).optional().describe('Product translations for different languages')
				})
				.describe('The data for updating the product')
		},
		async ({ id, product_data }) => {
			try {
				const updateData = convertProductDateFields(product_data);

				const response = await apiClient.put(`/api/products/${id}`, updateData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating product:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update product: ${message}`);
			}
		}
	);

	// Delete product tool
	server.tool(
		'delete_product',
		'Delete a product',
		{
			id: z.string().uuid().describe('The product ID')
		},
		async ({ id }) => {
			try {
				await apiClient.delete(`/api/products/${id}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify({ success: true, message: 'Product deleted successfully', id }, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting product:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to delete product: ${message}`);
			}
		}
	);

	// Create product with translations tool
	server.tool(
		'create_product_with_translations',
		"Create a new product with multiple language translations",
		{
			product_data: z.object({
				code: z.string().describe('Product code (required)'),
				enabled: z.boolean().optional().default(true).describe('Whether the product is enabled'),
				imageUrl: z.string().optional().describe('Product image URL'),
				productTypeId: z.string().uuid().optional().describe('Product type ID'),
				productCategoryId: z.string().uuid().optional().describe('Product category ID'),
				translations: z.array(z.object({
					languageCode: z.string().describe('Language code (e.g., "en", "fr", "es")'),
					name: z.string().describe('Product name in this language'),
					description: z.string().optional().describe('Product description in this language')
				})).min(1).describe('Product translations (at least one required)')
			}).describe('Product data with translations')
		},
		async ({ product_data }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const createData = {
					...product_data,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				};

				const response = await apiClient.post('/api/products/create-with-translations', createData);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error creating product with translations:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to create product with translations: ${message}`);
			}
		}
	);

	// Update product with translations tool
	server.tool(
		'update_product_with_translations',
		'Update a product with multiple language translations',
		{
			id: z.string().uuid().describe('The product ID'),
			product_data: z.object({
				code: z.string().optional().describe('Product code'),
				enabled: z.boolean().optional().describe('Whether the product is enabled'),
				imageUrl: z.string().optional().describe('Product image URL'),
				productTypeId: z.string().uuid().optional().describe('Product type ID'),
				productCategoryId: z.string().uuid().optional().describe('Product category ID'),
				translations: z.array(z.object({
					languageCode: z.string().describe('Language code (e.g., "en", "fr", "es")'),
					name: z.string().describe('Product name in this language'),
					description: z.string().optional().describe('Product description in this language')
				})).optional().describe('Product translations to update')
			}).describe('Product data with translations to update')
		},
		async ({ id, product_data }) => {
			try {
				const response = await apiClient.put(`/api/products/${id}/update-with-translations`, product_data);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error updating product with translations:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to update product with translations: ${message}`);
			}
		}
	);

	// Bulk create products tool
	server.tool(
		'bulk_create_products',
		"Create multiple products in bulk for the authenticated user's organization",
		{
			products: z.array(
				ProductSchema.partial()
					.required({
						code: true
					})
					.extend({
						translations: z.array(z.object({
							languageCode: z.string(),
							name: z.string(),
							description: z.string().optional()
						})).optional()
					})
					.describe('Product data')
			).describe('Array of product data to create')
		},
		async ({ products }) => {
			try {
				const defaultParams = validateOrganizationContext();

				// Add organization and tenant ID to each product
				const productsWithDefaults = products.map((product) => convertProductDateFields({
					...product,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId })
				}));

				const response = await apiClient.post('/api/products/bulk', { products: productsWithDefaults });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error bulk creating products:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to bulk create products: ${message}`);
			}
		}
	);

	// Get product variants tool
	server.tool(
		'get_product_variants',
		'Get variants for a specific product',
		{
			productId: z.string().uuid().describe('The product ID'),
			relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["options"])'),
			langCode: z.string().optional().describe('Language code for translations')
		},
		async ({ productId, relations, langCode }) => {
			try {
				const params = {
					productId,
					...(relations && { relations }),
					...(langCode && { langCode })
				};

				const response = await apiClient.get('/api/product-variants', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching product variants:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to fetch product variants: ${message}`);
			}
		}
	);

	// Search products tool
	server.tool(
		'search_products',
		'Search products by name, code, or description',
		{
			query: z.string().describe('Search query'),
			langCode: z.string().optional().describe('Language code for translations'),
			limit: z.number().optional().default(20).describe('Maximum number of results'),
			enabled: z.boolean().optional().describe('Filter by enabled status'),
			productCategoryId: z.string().uuid().optional().describe('Filter by product category ID')
		},
		async ({ query, langCode, limit = 20, enabled, productCategoryId }) => {
			try {
				const defaultParams = validateOrganizationContext();

				const params = {
					query,
					organizationId: defaultParams.organizationId,
					...(defaultParams.tenantId && { tenantId: defaultParams.tenantId }),
					...(langCode && { langCode }),
					limit,
					...(enabled !== undefined && { enabled }),
					...(productCategoryId && { productCategoryId })
				};

				const response = await apiClient.get('/api/products/search', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error searching products:', error);
				const message = error instanceof Error ? error.message : 'Unknown error';
				throw new Error(`Failed to search products: ${message}`);
			}
		}
	);
};
