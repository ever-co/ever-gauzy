import { Column, Entity, Index, JoinColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Base } from '../core/entities/base';
import { FeatureOrganization } from './feature_organization.entity';
import { IFeature, IFeatureOrganization } from '@gauzy/models';
import { IsNotEmpty, IsString } from 'class-validator';

@Entity('feature')
export class Feature extends Base implements IFeature {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	code: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	description?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column({ nullable: true })
	image?: string;

	@ApiProperty({ type: String, readOnly: true })
	@IsString()
	@Column()
	link: string;

	@ApiProperty({ type: FeatureOrganization })
	@OneToMany(
		() => FeatureOrganization,
		(featureOrganization) => featureOrganization.feature
	)
	@JoinColumn()
	featureOrganizations?: IFeatureOrganization[];
}
