import { IEstimateEmail } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Column } from 'typeorm';
import { TenantOrganizationBaseEntity } from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEstimateEmailRepository } from './repository/mikro-orm-estimate-email.repository';

@MultiORMEntity('estimate_email', { mikroOrmRepository: () => MikroOrmEstimateEmailRepository })
export class EstimateEmail extends TenantOrganizationBaseEntity
	implements IEstimateEmail {

	@ApiProperty({ type: () => String })
	@Column()
	token?: string;

	@ApiProperty({ type: () => String })
	@Column()
	email?: string;

	@ApiProperty({ type: () => Date })
	@Column()
	expireDate?: Date;

	@ApiPropertyOptional({ type: () => Boolean })
	@Column({ nullable: true })
	convertAcceptedEstimates?: boolean;
}
