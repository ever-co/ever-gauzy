// import { SafeHtml } from '@angular/platform-browser';
// import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
// import { ApiProperty } from '@nestjs/swagger';
// import { IHelpCenter } from '@gauzy/models';
// import { Base } from '../core/entities/base';

// @Entity('help-center-menu')
// export class HelpCenterMenu extends Base implements IHelpCenter {
// 	@ApiProperty({ type: String })
// 	@Column()
// 	name: string;

// 	@ApiProperty({ type: String })
// 	@Column()
// 	description?: string;

// 	@ApiProperty()
// 	@Column()
// 	data?: SafeHtml;

// 	@OneToMany((type) => HelpCenterMenu, (children) => children.children)
// 	parent: HelpCenterMenu;

// 	@ManyToOne((type) => HelpCenterMenu, (children) => children.parent)
// 	children: HelpCenterMenu;
// }
