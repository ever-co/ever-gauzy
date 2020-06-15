import {
	Entity,
	Column,
	ManyToOne,
	JoinColumn,
	RelationId,
	JoinTable,
	ManyToMany
} from 'typeorm';
import { Base } from '../core/entities/base';
import { Payment as IPayment, CurrenciesEnum } from '@gauzy/models';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsEnum,
	IsString,
	IsOptional,
	IsDate,
	IsNumber
} from 'class-validator';
import { Tenant } from '../tenant/tenant.entity';
import { Tag } from '../tags/tag.entity';
import { User } from '../user/user.entity';
import { Invoice } from '../invoice/invoice.entity';
import { Organization } from '../organization/organization.entity';

@Entity('payment')
export class Payment extends Base implements IPayment {
	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	invoiceId?: string;

	@ApiPropertyOptional({ type: Invoice })
	@ManyToOne((type) => Invoice, (invoice) => invoice.payments, {
		onDelete: 'SET NULL'
	})
	@JoinColumn()
	invoice?: Invoice;

	@ApiPropertyOptional({ type: Organization })
	@ManyToOne(
		(type) => Organization,
		(organization) => organization.payments,
		{
			onDelete: 'SET NULL'
		}
	)
	@JoinColumn()
	organization?: Organization;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	organizationId?: string;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column({ nullable: true })
	userId?: string;

	@ApiPropertyOptional({ type: User })
	@ManyToOne((type) => User)
	@JoinColumn()
	recordedBy?: User;

	@ApiPropertyOptional({ type: Date })
	@IsDate()
	@IsOptional()
	@Column({ nullable: true })
	paymentDate?: Date;

	@ApiPropertyOptional({ type: Number })
	@IsNumber()
	@IsOptional()
	@Column({ nullable: true, type: 'numeric' })
	amount?: number;

	@ApiPropertyOptional({ type: String })
	@IsString()
	@IsOptional()
	@Column()
	note?: string;

	@ApiPropertyOptional({ type: String, enum: CurrenciesEnum })
	@IsEnum(CurrenciesEnum)
	@Column()
	currency?: string;

	@ApiProperty({ type: Tenant })
	@ManyToOne(() => Tenant, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn()
	tenant?: Tenant;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((payment: Payment) => payment.tenant)
	readonly tenantId?: string;

	@ManyToMany(() => Tag)
	@JoinTable({
		name: 'tag_payment'
	})
	tags?: Tag[];
}
