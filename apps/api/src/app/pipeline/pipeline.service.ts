import { CrudService } from '../core/crud';
import { Pipeline } from './pipeline.entity';
import { DeepPartial, EntityManager, Repository, Transaction, TransactionManager } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Stage } from '../stage/stage.entity';

@Injectable()
export class PipelineService extends CrudService<Pipeline>
{

  public constructor(
    @InjectRepository( Pipeline )
    pipelineRepository: Repository<Pipeline> )
  {
    super( pipelineRepository );
  }

  @Transaction()
  public async create( entity: DeepPartial<Pipeline>, @TransactionManager() manager: EntityManager, ...options ): Promise<Pipeline>
  {
    // Persist pipeline
    const { name, description, organizationId } = entity;
    const pipeline = await manager.save( manager.create( Pipeline, {
      organizationId,
      description,
      name,
    }) );
    const { id: pipelineId } = pipeline;

    // Persist pipeline stages
    if ( entity.stages?.length ) {
      for ( const { name, index, description } of entity.stages ) {
        await manager.save( manager.create( Stage, {
          description,
          pipelineId,
          index,
          name,
        }) );
      }
    }

    return pipeline;
  }

}
