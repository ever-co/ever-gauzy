import { Base } from '../core/entities/base';
import { Entity, Column, ManyToOne, ManyToMany } from 'typeorm';
import { Tag as ITag } from '@gauzy/models';
import { ApiProperty } from '@nestjs/swagger';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Candidate } from '../candidate/candidate.entity';
import { Employee } from '../employee/employee.entity';
import { Equipment } from '../equipment/equipment.entity';
import { EventType } from '../event-types/event-type.entity';
import { Income } from '../income/income.entity';
import { Expense } from '../expense/expense.entity';
import { Invoice } from '../invoice/invoice.entity';

@Entity('tag')
export class Tag extends Base implements ITag {
	@ApiProperty({ type: String })
	@Column()
	name?: string;

	@ApiProperty({ type: String })
	@Column()
	description?: string;

	@ApiProperty({ type: String })
	@Column()
	color?: string;

	@ApiProperty()
	@ManyToOne((type) => Organization)
	organization?: Organization;

	@ApiProperty()
	@ManyToOne((type) => Tenant)
	tenant?: Tenant;

	@ManyToMany((type) => Candidate, (candidate) => candidate.tags)
	candidate?: Candidate[];

	@ManyToMany((type) => Employee, (employee) => employee.tags)
	employee?: Employee[];

	@ManyToMany((type) => Equipment, (equipment) => equipment.tags)
	equipment?: Equipment[];

	@ManyToMany((type) => EventType, (eventType) => eventType.tags)
	eventType?: EventType[];

	@ManyToMany((type) => Income, (income) => income.tags)
	income?: Income[];

	@ManyToMany((type) => Expense, (expense) => expense.tags)
	expense?: Expense[];

	@ManyToMany((type) => Invoice, (invoice) => invoice.tags)
	invoice?: Invoice[];
}
