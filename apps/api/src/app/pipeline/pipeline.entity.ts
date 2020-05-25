import { Organization } from '../organization/organization.entity';
import { Pipeline as IPipeline } from '@gauzy/models';
import { Column, Entity, OneToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Base } from '../core/entities/base';



@Entity( 'pipelines' )
export class Pipeline extends Base implements IPipeline
{
  @OneToOne( () => Organization )
  public organization: Organization;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ type: String })
  public description: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public reference: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public name: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @Column()
  public organizationId: string;

}
