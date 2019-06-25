import {
    Column,
    Entity,
    Index,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { Base } from '../core/entities/base';
import { Role as IRole } from '@gauzy/models';

export enum RolesEnum {
    ADMIN = 'ADMIN',
    DATA_ENTRY = 'DATA_ENTRY',
    EMPLOYEE = 'EMPLOYEE',
}

@Entity('role')
export class Role extends Base implements IRole {
    @ApiModelProperty({ type: String, enum: RolesEnum })
    @IsEnum(RolesEnum)
    @IsNotEmpty()
    @Index()
    @Column()
    name: string;
}
