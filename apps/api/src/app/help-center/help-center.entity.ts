import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IHelpCenter } from '@gauzy/models';
import { Base } from '../core/entities/base';

@Entity('help_center_menu')
export class HelpCenter extends Base implements IHelpCenter {
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
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String })
	@Column({ nullable: true })
	data?: string;

	// @ManyToOne((type) => HelpCenterChildren, , {
	// 	cascade: true,
	// 	nullable: true
	// })
	// @JoinTable({
	// 	name: 'help_center_children'
	// })
	// documents: IHelpCenter[];

	@OneToMany((type) => HelpCenter, (children) => children.children, {
		cascade: true,
		nullable: true
	})
	parent?: IHelpCenter;

	@ManyToOne((type) => HelpCenter, (children) => children.parent)
	children?: IHelpCenter[];

	// insert() {
	// 	this.children;
	// }
}
