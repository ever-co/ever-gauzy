import { AttributeValue } from '../attribute-value/attribute-value.entity';
import { StageAttribute } from '../stage-attribute/stage-attribute.entity';
import { LeadAttribute as ILeadAttribute } from '@gauzy/models';
import { Column, Entity, ManyToOne, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';
import { Lead } from '../lead/lead.entity';



@Entity( 'lead_attributes' )
export class LeadAttribute extends Base implements ILeadAttribute
{
  @OneToOne( () => AttributeValue )
  public attributeValue: AttributeValue;

  @ManyToOne( () => StageAttribute )
  public stageAttribute: StageAttribute;

  @ManyToOne( () => Lead, ({ leadAttributes }) => leadAttributes )
  public lead: Lead;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public attributeValueId: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public stageAttributeId: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public leadId: string;

}
