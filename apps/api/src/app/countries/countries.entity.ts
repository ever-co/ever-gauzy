import { Countries as ICountries } from '@gauzy/models';
import { ApiModelProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Column, Entity, Index } from 'typeorm';
import { Base } from '../core/entities/base';

@Entity('countries')
export class Countries extends Base implements ICountries {
	@ApiModelProperty({ type: String })
	@Index()
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	isoCode: string;

	@ApiModelProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: false })
	country: string;
}
