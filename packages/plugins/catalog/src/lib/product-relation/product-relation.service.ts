import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ID } from '@gauzy/contracts';
import { RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { ProductRelationType } from '../catalog.types';
import { ProductRelation } from './product-relation.entity';
import { MikroOrmProductRelationRepository } from './repository/mikro-orm-product-relation.repository';
import { TypeOrmProductRelationRepository } from './repository/type-orm-product-relation.repository';

/**
 * Directed product-to-product links.
 *
 * The relation is a statement about the catalogue and not about one channel, so a target that is not
 * published where the reader is looking is filtered out when the relation is read rather than deleted
 * when it is noticed.
 */
@Injectable()
export class ProductRelationService extends TenantAwareCrudService<ProductRelation> {
	constructor(
		readonly typeOrmProductRelationRepository: TypeOrmProductRelationRepository,
		readonly mikroOrmProductRelationRepository: MikroOrmProductRelationRepository
	) {
		super(typeOrmProductRelationRepository, mikroOrmProductRelationRepository);
	}

	/**
	 * Creates a relation after refusing a self-reference and a duplicate of the same typed link.
	 *
	 * @param entity The relation to create.
	 * @returns The persisted relation.
	 * @throws BadRequestException When the link points a product at itself.
	 */
	public async create(entity: DeepPartial<ProductRelation>): Promise<ProductRelation> {
		if (entity.productId && entity.productId === entity.relatedProductId) {
			throw new BadRequestException('A product cannot be related to itself.');
		}

		return super.create({
			type: ProductRelationType.RELATED,
			position: 0,
			...entity
		});
	}

	/**
	 * Updates a relation, re-checking the self-reference rule when either end changes.
	 *
	 * @param id Id of the relation.
	 * @param entity The fields to change.
	 * @returns The updated relation.
	 */
	public async update(id: ID, entity: DeepPartial<ProductRelation>): Promise<ProductRelation> {
		const relation = await this.findOneByIdString(id);
		const productId = entity.productId ?? relation.productId;
		const relatedProductId = entity.relatedProductId ?? relation.relatedProductId;

		if (productId === relatedProductId) {
			throw new BadRequestException('A product cannot be related to itself.');
		}

		return (await super.update(id, entity)) as ProductRelation;
	}

	/**
	 * Reads the relations of one product in one direction.
	 *
	 * @param productId The source product.
	 * @param type An optional relation type to narrow the read to.
	 * @returns The relations declared from that product, in display order.
	 */
	public async findFrom(productId: ID, type?: ProductRelationType): Promise<ProductRelation[]> {
		return this.typeOrmProductRelationRepository.find({
			where: {
				productId,
				organizationId: RequestContext.currentOrganizationId(),
				...(type ? { type } : {})
			},
			relations: { relatedProduct: true },
			order: { type: 'ASC', position: 'ASC' }
		});
	}

	/**
	 * Reads the relations that point at one product — the inverse direction, which is a separate
	 * question because the relation is directed.
	 *
	 * @param productId The target product.
	 * @returns The relations declared towards that product.
	 */
	public async findTowards(productId: ID): Promise<ProductRelation[]> {
		return this.typeOrmProductRelationRepository.find({
			where: { relatedProductId: productId, organizationId: RequestContext.currentOrganizationId() },
			relations: { product: true },
			order: { type: 'ASC', position: 'ASC' }
		});
	}
}
