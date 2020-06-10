import { Base } from '../core/entities/base';
import { Pipeline as IPipeline } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import { Column, Entity, JoinColumn, ManyToOne, RelationId } from 'typeorm';
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@Entity( 'pipeline' )
export class Pipeline extends Base implements IPipeline
{

  @ManyToOne( () => Organization )
  @ApiProperty({ type: Organization })
  @JoinColumn()
  public organization: Organization;

  @RelationId( ({ organization }: Pipeline ) => organization )
  @ApiProperty({ type: String })
  @IsString()
  @Column()
  public organizationId: string;

  @Column({ nullable: true, type: 'text' })
  @IsString()
  public description: string;

  @IsString()
  @Column()
  public name: string;

}
