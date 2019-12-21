import {
    Column,
    Entity,
    Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum } from 'class-validator';
import { Base } from '../core/entities/base';
import { Role as IRole, RolesEnum } from '@gauzy/models';

@Entity('role')
export class Role extends Base implements IRole {
    @ApiProperty({ type: String, enum: RolesEnum })
    @IsEnum(RolesEnum)
    @IsNotEmpty()
    @Index()
    @Column()
    name: string;
}
