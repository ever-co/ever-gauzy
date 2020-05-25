import { AttributeValidator as IAttributeValidator } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';
import { Column, Entity } from 'typeorm';



@Entity( 'attribute_validators' )
export class AttributeValidator extends Base implements IAttributeValidator
{
  @Column({ type: 'jsonb', default: '[ "value" ]' })
  @ApiProperty({ type: String, isArray: true })
  public parameters: string[];

  @Column({ nullable: true, type: 'text' })
  @ApiProperty({ type: String })
  public description: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public reference: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public script: string;

}
