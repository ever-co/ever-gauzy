import {
    Column,
    Entity,
    Index,
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
}
