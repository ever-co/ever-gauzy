import { ICountry } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { BaseEntity } from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmCountryRepository } from './repository/mikro-orm-country.repository';

@MultiORMEntity('country', { mikroOrmRepository: () => MikroOrmCountryRepository })
export class Country extends BaseEntity implements ICountry {

	@ApiProperty({ type: () => String })
	@ColumnIndex()
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: false })
	isoCode: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: false })
	country: string;
}
