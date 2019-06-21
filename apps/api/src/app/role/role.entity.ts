import {
    Column,
    Entity,
    Index,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Base } from '../core/entities/base';
import { Role as IRole } from '@gauzy/models';

@Entity('role')
export class Role extends Base implements IRole {
    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    name: string;
}
