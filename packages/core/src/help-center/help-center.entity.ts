import { Entity, Column, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IHelpCenter, IHelpCenterArticle } from '@gauzy/contracts';
import {
	HelpCenterArticle,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('knowledge_base')
export class HelpCenter
	extends TenantOrganizationBaseEntity
	implements IHelpCenter {
	@ApiProperty({ type: String })
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@Column()
	flag: string;

	@ApiProperty({ type: String })
	@Column()
	icon: string;

	@ApiProperty({ type: String })
	@Column()
	privacy: string;

	@ApiProperty({ type: String })
	@Column()
	language: string;

	@ApiProperty({ type: String })
	@Column()
	color: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	data?: string;

	@ApiProperty({ type: Number })
	@Column({ nullable: true })
	index: number;

	@ManyToOne(() => HelpCenter, (children) => children.children, {
		cascade: ['insert'],
		nullable: true
	})
	parent?: IHelpCenter;

	@OneToMany(() => HelpCenter, (children) => children.parent, {
		cascade: ['insert'],
		nullable: true
	})
	children?: IHelpCenter[];

	@ManyToOne(() => HelpCenterArticle, { cascade: true })
	@JoinTable({
		name: 'HelpCenterArticle'
	})
	articles?: IHelpCenterArticle[];

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	parentId?: string;
}
