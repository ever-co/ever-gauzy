import { CrudService } from '../core/crud';
import { Pipeline } from './pipeline.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class PipelineService extends CrudService<Pipeline>
{

  public constructor(
    @InjectRepository( Pipeline )
    pipelineRepository: Repository<Pipeline> )
  {
    super( pipelineRepository );
  }

}
