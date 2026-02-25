import { MultiORMEnum, TenantAwareCrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { Not } from 'typeorm';
import { IPluginCategoryFindInput, IPluginCategoryTree } from '../../shared/models';
import { PluginCategory } from '../entities/plugin-category.entity';
import { MikroOrmPluginCategoryRepository } from '../repositories/mikro-orm-plugin-category.repository';
import { TypeOrmPluginCategoryRepository } from '../repositories/type-orm-plugin-category.repository';

@Injectable()
export class PluginCategoryService extends TenantAwareCrudService<PluginCategory> {
	constructor(
		public readonly typeOrmPluginCategoryRepository: TypeOrmPluginCategoryRepository,
		public readonly mikroOrmPluginCategoryRepository: MikroOrmPluginCategoryRepository
	) {
		super(typeOrmPluginCategoryRepository, mikroOrmPluginCategoryRepository);
	}

	/**
	 * Get hierarchical tree of plugin categories
	 */
	async getTree(options?: IPluginCategoryFindInput): Promise<IPluginCategoryTree[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Use Knex for the tree query with filtering
				const knex = (this.mikroOrmRepository as any).getKnex();
				let qb = knex('plugin_category as category').leftJoin(
					'plugin_category as parent',
					'category.parentId',
					'parent.id'
				);

				if (options?.isActive !== undefined) {
					qb = qb.where('category.isActive', options.isActive);
				}
				if (options?.name) {
					qb = qb.andWhere('category.name', 'ILIKE', `%${options.name}%`);
				}

				qb = qb.select('category.*').orderBy('category.order', 'asc').orderBy('category.name', 'asc');

				const rawCategories = await qb;
				const categories = rawCategories.map((row: any) => this.mikroOrmRepository.map(row));

				// Build tree structure
				return this.buildTree(categories);
			}
			case MultiORMEnum.TypeORM:
			default: {
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
		}
	}

	/**
	 * Check if a category is a descendant of another category
	 */
	async isDescendantOf(ancestorId: string, descendantId: string): Promise<boolean> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Walk the parent chain from descendantId to check for ancestorId
				const descendants = await this.getDescendants(ancestorId);
				return descendants.some((desc) => desc.id === descendantId);
			}
			case MultiORMEnum.TypeORM:
			default: {
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
		}
	}

	/**
	 * Get all ancestors of a category
	 */
	async getAncestors(categoryId: string): Promise<PluginCategory[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Walk the parent chain iteratively
				const ancestors: PluginCategory[] = [];
				let currentId = categoryId;

				while (currentId) {
					const category = await this.mikroOrmRepository.findOne({ id: currentId } as any, {
						populate: ['parent'] as any[]
					});
					if (!category || !category.parentId) break;

					const parent = await this.mikroOrmRepository.findOne({ id: category.parentId } as any);
					if (parent) {
						ancestors.push(parent);
						currentId = parent.parentId;
					} else {
						break;
					}
				}

				return ancestors;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const treeRepo = this.typeOrmPluginCategoryRepository.manager.getTreeRepository(PluginCategory);

				const category = await treeRepo.findOne({
					where: { id: categoryId }
				});

				if (!category) {
					return [];
				}

				return await treeRepo.findAncestors(category);
			}
		}
	}

	/**
	 * Get all descendants of a category
	 */
	async getDescendants(categoryId: string): Promise<PluginCategory[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				// MikroORM: Find all children recursively
				const descendants: PluginCategory[] = [];
				const children = await this.mikroOrmRepository.find({ parentId: categoryId } as any);

				for (const child of children) {
					descendants.push(child);
					const grandChildren = await this.getDescendants(child.id);
					descendants.push(...grandChildren);
				}

				return descendants;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const treeRepo = this.typeOrmPluginCategoryRepository.manager.getTreeRepository(PluginCategory);

				const category = await treeRepo.findOne({
					where: { id: categoryId }
				});

				if (!category) {
					return [];
				}

				return await treeRepo.findDescendants(category);
			}
		}
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
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-)|(-$)/g, '');

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
