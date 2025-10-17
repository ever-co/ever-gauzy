import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository, FindManyOptions, FindOneOptions, Not } from 'typeorm';
import { TenantAwareCrudService } from '@gauzy/core';
import { PluginCategory } from '../entities/plugin-category.entity';
import {
	IPluginCategory,
	IPluginCategoryCreateInput,
	IPluginCategoryUpdateInput,
	IPluginCategoryFindInput,
	IPluginCategoryTree
} from '../../shared/models';

@Injectable()
export class PluginCategoryService extends TenantAwareCrudService<PluginCategory> {
	constructor(
		@InjectRepository(PluginCategory)
		private readonly typeOrmPluginCategoryRepository: Repository<PluginCategory>
	) {
		super(typeOrmPluginCategoryRepository, null);
	}

	/**
	 * Get hierarchical tree of plugin categories
	 */
	async getTree(options?: IPluginCategoryFindInput): Promise<IPluginCategoryTree[]> {
		const queryBuilder = this.typeOrmPluginCategoryRepository.createQueryBuilder('category');

		// Add conditions based on options
		if (options?.isActive !== undefined) {
			queryBuilder.andWhere('category.isActive = :isActive', { isActive: options.isActive });
		}

		if (options?.name) {
			queryBuilder.andWhere('category.name ILIKE :name', { name: `%${options.name}%` });
		}

		// Get all categories with their relationships
		const categories = await queryBuilder
			.leftJoinAndSelect('category.parent', 'parent')
			.leftJoinAndSelect('category.children', 'children')
			.leftJoinAndSelect('category.plugins', 'plugins')
			.orderBy('category.order', 'ASC')
			.addOrderBy('category.name', 'ASC')
			.getMany();

		// Build tree structure
		return this.buildTree(categories);
	}

	/**
	 * Check if a category is a descendant of another category
	 */
	async isDescendantOf(ancestorId: string, descendantId: string): Promise<boolean> {
		const treeRepo = this.typeOrmPluginCategoryRepository.manager.getTreeRepository(PluginCategory);

		const ancestor = await treeRepo.findOne({
			where: { id: ancestorId }
		});

		if (!ancestor) {
			return false;
		}

		const descendants = await treeRepo.findDescendants(ancestor);
		return descendants.some((desc) => desc.id === descendantId);
	}

	/**
	 * Get all ancestors of a category
	 */
	async getAncestors(categoryId: string): Promise<PluginCategory[]> {
		const treeRepo = this.typeOrmPluginCategoryRepository.manager.getTreeRepository(PluginCategory);

		const category = await treeRepo.findOne({
			where: { id: categoryId }
		});

		if (!category) {
			return [];
		}

		return await treeRepo.findAncestors(category);
	}

	/**
	 * Get all descendants of a category
	 */
	async getDescendants(categoryId: string): Promise<PluginCategory[]> {
		const treeRepo = this.typeOrmPluginCategoryRepository.manager.getTreeRepository(PluginCategory);

		const category = await treeRepo.findOne({
			where: { id: categoryId }
		});

		if (!category) {
			return [];
		}

		return await treeRepo.findDescendants(category);
	}

	/**
	 * Build hierarchical tree structure from flat category list
	 */
	private buildTree(categories: PluginCategory[]): IPluginCategoryTree[] {
		const categoryMap = new Map<string, IPluginCategoryTree>();
		const rootCategories: IPluginCategoryTree[] = [];

		// First pass: create tree nodes
		categories.forEach((category) => {
			const treeNode: IPluginCategoryTree = {
				...category,
				level: 0,
				path: [],
				hasChildren: false,
				childCount: 0,
				pluginCount: category.plugins ? category.plugins.length : 0
			} as IPluginCategoryTree;
			categoryMap.set(category.id, treeNode);
		});

		// Second pass: build hierarchy and calculate metrics
		categories.forEach((category) => {
			const treeNode = categoryMap.get(category.id)!;

			if (category.parent) {
				const parent = categoryMap.get(category.parent.id);
				if (parent) {
					treeNode.level = parent.level + 1;
					treeNode.path = [...parent.path, parent.name];
					parent.hasChildren = true;
					parent.childCount++;
				}
			} else {
				rootCategories.push(treeNode);
			}
		});

		return rootCategories.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
	}

	/**
	 * Validate category hierarchy rules
	 */
	async validateHierarchy(categoryId: string, parentId?: string): Promise<void> {
		if (!parentId) {
			return;
		}

		// Check if parent exists
		const parent = await this.findOneByIdString(parentId);
		if (!parent) {
			throw new Error(`Parent category with ID '${parentId}' not found`);
		}

		// Prevent self-reference
		if (categoryId === parentId) {
			throw new Error('Category cannot be its own parent');
		}

		// Prevent circular references
		const isCircular = await this.isDescendantOf(categoryId, parentId);
		if (isCircular) {
			throw new Error('Cannot create circular reference in category hierarchy');
		}
	}

	/**
	 * Generate unique slug from name
	 */
	async generateUniqueSlug(
		name: string,
		tenantId: string,
		organizationId: string,
		excludeId?: string
	): Promise<string> {
		let baseSlug = name
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '');

		let slug = baseSlug;
		let counter = 1;

		while (true) {
			const existing = await this.findOneByWhereOptions({
				slug,
				tenantId,
				organizationId,
				...(excludeId && { id: Not(excludeId) })
			});

			if (!existing) {
				return slug;
			}

			slug = `${baseSlug}-${counter}`;
			counter++;
		}
	}
}
