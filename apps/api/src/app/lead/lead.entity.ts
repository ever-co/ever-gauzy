import { LeadAttribute } from '../lead-attribute/lead-attribute.entity';
import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { Employee } from '../employee/employee.entity';
import { Lead as ILead } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';



@Entity( 'leads' )
export class Lead extends Base implements ILead
{
  @OneToMany( () => LeadAttribute, ({ lead }) => lead )
  public leadAttributes: LeadAttribute[];

  @ManyToOne( () => Employee )
  public saleRepresentative: Employee;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public saleRepresentativeId: string;
}
