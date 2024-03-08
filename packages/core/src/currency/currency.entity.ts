import { ICurrency } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Index } from 'typeorm';
import { BaseEntity } from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCurrencyRepository } from './repository/mikro-orm-currency.repository';

@MultiORMEntity('currency', { mikroOrmRepository: () => MikroOrmCurrencyRepository })
export class Currency extends BaseEntity implements ICurrency {
	@ApiProperty({ type: () => String })
	@Index()
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: false })
	isoCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: false })
	currency: string;
}
