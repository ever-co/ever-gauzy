import { AttributeDefinition } from '../attribute-definition/attribute-definition.entity';
import { AttributeValue as IAttributeValue } from '@gauzy/models';
import { Column, Entity, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';



@Entity( 'attribute_values' )
export class AttributeValue extends Base implements IAttributeValue
{
  @OneToOne( () => AttributeDefinition )
  public attributeDefinition: AttributeDefinition;

  @ApiProperty({ type: String, isArray: true })
  @IsNotEmpty({ each: true })
  @Column({ type: 'jsonb' })
  public values: string[];

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public attributeDefinitionId: string;

}
