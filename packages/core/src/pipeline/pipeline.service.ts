import { TenantAwareCrudService } from './../core/crud';
import { Pipeline } from './pipeline.entity';
import {
	FindOptionsWhere,
	Like,
	Repository,
	UpdateResult
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Injectable } from '@nestjs/common';
import { Deal } from '../deal/deal.entity';
import { User } from '../user/user.entity';
import { RequestContext } from '../core/context';

@Injectable()
export class PipelineService extends TenantAwareCrudService<Pipeline> {
	public constructor(
		@InjectRepository(Deal)
		protected dealRepository: Repository<Deal>,

		@InjectRepository(Pipeline)
		protected pipelineRepository: Repository<Pipeline>,

		@InjectRepository(User)
		protected userRepository: Repository<User>
	) {
		super(pipelineRepository);
	}

	public async findDeals(pipelineId: string) {
		const tenantId = RequestContext.currentTenantId();
		const items: Deal[] = await this.dealRepository
			.createQueryBuilder('deal')
			.leftJoin('deal.stage', 'pipeline_stage')
			.where('pipeline_stage.pipelineId = :pipelineId', { pipelineId })
			.andWhere('pipeline_stage.tenantId = :tenantId', { tenantId })
			.groupBy('pipeline_stage.id')
			// FIX: error: column "deal.id" must appear in the GROUP BY clause or be used in an aggregate function
			.addGroupBy('deal.id')
			// END_FIX
			.orderBy('pipeline_stage.index', 'ASC')
			.getMany();

		const { length: total } = items;

		for (const deal of items) {
			deal.createdBy = await this.userRepository.findOneBy({
				id: deal.createdByUserId
			});
		}

		return { items, total };
	}

	public async update(
		id: string | number | FindOptionsWhere<Pipeline>,
		partialEntity: QueryDeepPartialEntity<Pipeline>
	): Promise<UpdateResult | Pipeline> {
		const onePipeline = await this.repository.findOneBy({ id } as FindOptionsWhere<Pipeline>);
		const pipeline = this.repository.create({ ...partialEntity, id: onePipeline.id } as Pipeline);
		return await this.repository.update(id, pipeline);
	}

	public pagination(filter: any) {
		if ('where' in filter) {
			const { where } = filter;
			if ('name' in where) {
				const { name } = where;
				filter.where.name = Like(`%${name}%`)
			}
			if ('description' in where) {
				const { description } = where;
				filter.where.description = Like(`%${description}%`)
			}
			if ('isActive' in where) {
				const { isActive } = where;
				if (isActive === 'active') {
					filter.where.isActive = 1;
				}
				if (isActive === 'inactive') {
					filter.where.isActive = 0;
				}
			}
			if ('stages' in where) {
				const { stages } = where;
				filter.where.stages = {
					name: Like(`%${stages}%`)
				}
			}
		}
		return super.paginate(filter);
	}
}
