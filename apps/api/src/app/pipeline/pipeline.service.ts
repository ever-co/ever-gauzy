import { InjectRepository } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Repository } from 'typeorm';



@Injectable()
export class PipelineService extends CrudService<Pipeline>
{
  public constructor(
    @InjectRepository( Pipeline )
    pipelineRepository: Repository<Pipeline>,
  )
  {
    super( pipelineRepository );
  }
}
