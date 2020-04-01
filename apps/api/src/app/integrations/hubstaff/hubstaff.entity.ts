import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, RelationId, ManyToOne } from 'typeorm';
import { User } from '../../user';

@Entity('hubstaff')
export class Hubstaff {
	@ApiProperty({ type: User })
	@ManyToOne((type) => User, { nullable: false })
	@JoinColumn()
	user: User;

	@ApiProperty({ type: String, readOnly: true })
	@RelationId((hubstaff: Hubstaff) => hubstaff.user)
	readonly userId: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	clientId: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	clientSecret: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	access_token: string;

	@ApiProperty({ type: String })
	@Column({ nullable: false })
	refresh_token: string;
}
