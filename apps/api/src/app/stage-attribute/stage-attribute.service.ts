import { StageAttribute } from './stage-attribute.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Repository } from 'typeorm';



@Injectable()
export class StageAttributeService extends CrudService<StageAttribute>
{
  public constructor(
    @InjectRepository( StageAttribute )
    stageAttributeRepository: Repository<StageAttribute>,
  )
  {
    super( stageAttributeRepository );
  }
}
