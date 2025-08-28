import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { validateOrganizationContext } from './utils';
import { ProductSchema } from '../schema';
import { sanitizeErrorMessage, sanitizeForLogging } from '../common/security-utils';

const logger = new Logger('ProductTools');


/**
 * Interface for product data with date fields that need conversion
 */
interface ProductDataWithDates {
	[key: string]: unknown;
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
			data: z.object({
				relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["productType", "productCategory", "tags"])'),
				findInput: z.object({
					enabled: z.boolean().optional(),
					productCategoryId: z.string().uuid().optional(),
					productTypeId: z.string().uuid().optional()
				}).optional().describe('Find input filters')
			}).optional().describe('Query data object'),
			page: z.number().optional().describe('Page number for pagination'),
			limit: z.number().optional().describe('Number of items per page')
		},
		async ({ data = {}, page, limit }) => {
			try {
				const params = {
					data: JSON.stringify(data),
					...(page && { page }),
					...(limit && { _limit: limit })
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
				logger.error('Error fetching products:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch products: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get products with translations tool
	server.tool(
		'get_products_translated',
		"Get list of products with translations for a specific language",
		{
			langCode: z.string().describe('Language code for translations (e.g., "en", "fr", "es")'),
			data: z.object({
				relations: z.array(z.string()).optional().describe('Relations to include'),
				findInput: z.object({
					enabled: z.boolean().optional(),
					productCategoryId: z.string().uuid().optional()
				}).optional().describe('Find input filters')
			}).optional().describe('Query data object'),
			page: z.number().optional().describe('Page number for pagination'),
			limit: z.number().optional().describe('Number of items per page')
		},
		async ({ langCode, data = {}, page, limit }) => {
			try {
				const params = {
					data: JSON.stringify(data),
					...(page && { page }),
					...(limit && { _limit: limit })
				};

				const response = await apiClient.get(`/api/products/local/${langCode}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching translated products:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch translated products: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get product count tool
	server.tool(
		'get_product_count',
		"Get product count in the authenticated user's organization",
		{
			data: z.object({
				findInput: z.object({
					enabled: z.boolean().optional(),
					productCategoryId: z.string().uuid().optional(),
					productTypeId: z.string().uuid().optional()
				}).optional().describe('Find input filters')
			}).optional().describe('Query data object')
		},
		async ({ data = {} }) => {
			try {
				const params = {
					data: JSON.stringify(data)
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
				logger.error('Error fetching product count:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch product count: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get products by pagination tool
	server.tool(
		'get_products_pagination',
		"Get products with pagination support",
		{
			page: z.number().optional().default(1).describe('Page number'),
			limit: z.number().optional().default(10).describe('Items per page'),
			search: z.string().optional().describe('Search term'),
			relations: z.array(z.string()).optional().describe('Relations to include'),
			where: z.object({
				enabled: z.boolean().optional(),
				productCategoryId: z.string().uuid().optional(),
				productTypeId: z.string().uuid().optional()
			}).optional().describe('Where conditions')
		},
		async ({ page = 1, limit = 10, search, relations, where }) => {
			try {
				const params = {
					page,
					limit,
					...(search && { search }),
					...(relations && { relations }),
					...(where && { where })
				};

				const response = await apiClient.get('/api/products/pagination', { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching products pagination:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch products pagination: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get product by ID tool
	server.tool(
		'get_product',
		'Get a specific product by ID',
		{
			id: z.string().uuid().describe('The product ID'),
			data: z.object({
				relations: z.array(z.string()).optional().describe('Relations to include (e.g., ["productType", "productCategory", "tags"])'),
				findInput: z.object({}).optional().describe('Additional find input')
			}).optional().describe('Query data object')
		},
		async ({ id, data = {} }) => {
			try {
				const params = {
					data: JSON.stringify(data)
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
				logger.error('Error fetching product:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch product: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Get product translated by ID tool
	server.tool(
		'get_product_translated',
		'Get a specific product by ID with translations',
		{
			id: z.string().uuid().describe('The product ID'),
			langCode: z.string().describe('Language code for translations'),
			data: z.object({
				relations: z.array(z.string()).optional().describe('Relations to include')
			}).optional().describe('Query data object')
		},
		async ({ id, langCode, data = {} }) => {
			try {
				const params = {
					data: JSON.stringify(data)
				};

				const response = await apiClient.get(`/api/products/local/${langCode}/${id}`, { params });

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error fetching translated product:', sanitizeForLogging(error));
				throw new Error(`Failed to fetch translated product: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Create product tool
	server.tool(
		'create_product',
		"Create a new product in the authenticated user's organization",
		{
			product_data: ProductSchema.partial()
				.describe('The data for creating the product')
		},
		async ({ product_data }) => {
			try {
				const createData = convertProductDateFields(product_data);

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
				logger.error('Error creating product:', sanitizeForLogging(error));
				throw new Error(`Failed to create product: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Update product tool
	server.tool(
		'update_product',
		'Update an existing product',
		{
			id: z.string().uuid().describe('The product ID'),
			product_data: ProductSchema.partial().describe('The data for updating the product')
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
				logger.error('Error updating product:', sanitizeForLogging(error));
				throw new Error(`Failed to update product: ${sanitizeErrorMessage(error)}`);
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
				logger.error('Error deleting product:', sanitizeForLogging(error));
				throw new Error(`Failed to delete product: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Add gallery images tool
	server.tool(
		'add_product_gallery_images',
		'Add images to product gallery',
		{
			productId: z.string().uuid().describe('The product ID'),
			images: z.array(z.object({
				id: z.string().optional(),
				url: z.string(),
				alt: z.string().optional(),
				title: z.string().optional()
			})).describe('Array of image objects to add to gallery')
		},
		async ({ productId, images }) => {
			try {
				const response = await apiClient.post(`/api/products/add-images/${productId}`, images);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error adding gallery images:', sanitizeForLogging(error));
				throw new Error(`Failed to add gallery images: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Set featured image tool
	server.tool(
		'set_product_featured_image',
		'Set an image as featured for a product',
		{
			productId: z.string().uuid().describe('The product ID'),
			image: z.object({
				id: z.string().optional(),
				url: z.string(),
				alt: z.string().optional(),
				title: z.string().optional()
			}).describe('Image object to set as featured')
		},
		async ({ productId, image }) => {
			try {
				const response = await apiClient.post(`/api/products/set-as-featured/${productId}`, image);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error setting featured image:', sanitizeForLogging(error));
				throw new Error(`Failed to set featured image: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete gallery image tool
	server.tool(
		'delete_product_gallery_image',
		'Delete an image from product gallery',
		{
			productId: z.string().uuid().describe('The product ID'),
			imageId: z.string().uuid().describe('The image ID to delete')
		},
		async ({ productId, imageId }) => {
			try {
				const response = await apiClient.delete(`/api/products/${productId}/gallery-image/${imageId}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting gallery image:', sanitizeForLogging(error));
				throw new Error(`Failed to delete gallery image: ${sanitizeErrorMessage(error)}`);
			}
		}
	);

	// Delete featured image tool
	server.tool(
		'delete_product_featured_image',
		'Delete the featured image of a product',
		{
			productId: z.string().uuid().describe('The product ID')
		},
		async ({ productId }) => {
			try {
				const response = await apiClient.delete(`/api/products/featured-image/${productId}`);

				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(response, null, 2)
						}
					]
				};
			} catch (error) {
				logger.error('Error deleting featured image:', sanitizeForLogging(error));
				throw new Error(`Failed to delete featured image: ${sanitizeErrorMessage(error)}`);
			}
		}
	);
};
