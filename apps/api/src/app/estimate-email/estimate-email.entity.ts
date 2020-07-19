import { EstimateEmail as IEstimateEmail } from '@gauzy/models';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEmail, IsString } from 'class-validator';
import { Column, Entity } from 'typeorm';
import { Base } from '../core/entities/base';

@Entity('estimate_email')
export class EstimateEmail extends Base implements IEstimateEmail {
	@ApiPropertyOptional({ type: String })
	@IsString()
	@Column()
	token?: string;

	@ApiPropertyOptional({ type: String })
	@IsEmail()
	@Column()
	email?: string;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@Column()
	expireDate?: Date;
}
