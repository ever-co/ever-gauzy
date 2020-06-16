import { Base } from '../core/entities/base';
import { Pipeline as IPipeline } from '@gauzy/models';
import { Organization } from '../organization/organization.entity';
import {
  AfterInsert,
  AfterLoad,
  AfterUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
} from 'typeorm';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Stage } from '../stage/stage.entity';

@Entity( 'pipeline' )
export class Pipeline extends Base implements IPipeline
{
  @OneToMany( () => Stage, ({ pipeline }) => pipeline )
  @ApiProperty({ type: Stage })
  public stages: Stage[];

  @ManyToOne( () => Organization )
  @ApiProperty({ type: Organization })
  @JoinColumn()
  public organization: Organization;

  @RelationId( ({ organization }: Pipeline ) => organization )
  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  @Column()
  public organizationId: string;

  @Column({ nullable: true, type: 'text' })
  @ApiProperty({ type: String })
  @IsString()
  public description: string;

  @ApiProperty({ type: String })
  @IsNotEmpty()
  @IsString()
  @Column()
  public name: string;

  @AfterLoad()
  @AfterInsert()
  @AfterUpdate()
  private [ Symbol() as any ](): void {
    if ( this.stages ) {
      this.stages = this.stages.sort( ({ index: a }, { index: b }) => a - b );
    }
  }

}
