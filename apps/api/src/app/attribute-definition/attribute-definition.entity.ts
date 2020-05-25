import { AttributeValidator } from '../attribute-validator/attribute-validator.entity';
import { AttributeDefinition as IAttributeDefinition } from '@gauzy/models';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';



@Entity( 'attribute_definitions' )
export class AttributeDefinition extends Base implements IAttributeDefinition
{
  @JoinTable({ name: 'attribute_definitions_attribute_validators' })
  @ManyToMany( () => AttributeValidator )
  @IsNotEmpty({ each: true })
  public validators: AttributeValidator[];

  @ApiProperty({ type: String })
  @Column({ nullable: true })
  public validationScript: string;

  @Column({ nullable: true, type: 'text' })
  @ApiProperty({ type: String })
  public description: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public name: string;

}
