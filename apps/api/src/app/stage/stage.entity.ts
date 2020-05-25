import { StageAttribute } from '../stage-attribute/stage-attribute.entity';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { Pipeline } from '../pipeline/pipeline.entity';
import { Stage as IStage } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';



@Entity( 'stages' )
export class Stage extends Base implements IStage
{
  @OneToMany( () => StageAttribute, ({ stage }) => stage )
  public entryStageAttributes: StageAttribute[];

  @OneToMany( () => StageAttribute, ({ stage }) => stage )
  public exitStageAttributes: StageAttribute[];

  @ManyToOne( () => Pipeline )
  public pipeline: Pipeline;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  public reference: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  public name: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public pipelineId: string;

}
