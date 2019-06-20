import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    UpdateDateColumn,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDate, IsOptional } from 'class-validator';
import { Base } from '../core/entities/base';
import { Organization as IOrganization } from '@gauzy/models';

@Entity('organization')
export class Organization extends Base implements IOrganization {
    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    name: string;

    @ApiModelProperty({ type: Date })
    @IsDate()
    @IsOptional()
    @Column({ nullable: true })
    valueDate?: Date;

    @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
    @CreateDateColumn({ type: 'timestamptz' })
    createdAt?: Date;

    @ApiModelProperty({ type: 'string', format: 'date-time', example: '2018-11-21T06:20:32.232Z' })
    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt?: Date;
}
