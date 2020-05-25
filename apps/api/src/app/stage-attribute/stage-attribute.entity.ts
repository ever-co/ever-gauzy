import { AttributeDefinition } from '../attribute-definition/attribute-definition.entity';
import { StageAttribute as IStageAttribute } from '@gauzy/models';
import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Stage } from '../stage/stage.entity';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';



@Entity( 'stage_attributes' )
export class StageAttribute extends Base implements IStageAttribute
{
  @ManyToOne( () => AttributeDefinition )
  public attributeDefinition: AttributeDefinition;

  @ApiProperty({ type: Boolean })
  @Column({ default: false })
  public isMultivalued: boolean;

  @ApiProperty({ type: Boolean })
  @Column({ default: false })
  public isMandatory: boolean;

  @ManyToOne( () => Stage )
  public stage: Stage;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public attributeDefinitionId: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  public stageId: string;

}
