import { Entity, Index, Column } from 'typeorm';
import { Base } from '../core/entities/base';
import { UserOrganization as  IUserOrganization } from '@gauzy/models';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

@Entity('user_organization')
export class UserOrganization extends Base implements IUserOrganization {
    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    userId: string;

    @ApiModelProperty({ type: String })
    @IsString()
    @IsNotEmpty()
    @Index()
    @Column()
    orgId: string;

    @ApiModelProperty({ type: Boolean, default: true })
    @Index()
    @Column({ default: true })
    isDefault: boolean;

    @ApiModelProperty({ type: Boolean, default: true })
    @Index()
    @Column({ default: true })
    isActive: boolean;
}
