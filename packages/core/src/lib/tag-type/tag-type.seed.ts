import { DataSource } from 'typeorm';
import { IOrganization, ITagType, ITenant } from '@gauzy/contracts';
import { TagType } from './tag-type.entity';
import { DEFAULT_TAG_TYPES } from './default-tag-types';

export const createTagTypes = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<ITagType[]> => {
	const tagTypes: TagType[] = [];
	DEFAULT_TAG_TYPES.forEach(({ type }) => {
		for (const organization of organizations) {
			const entity = new TagType();
			entity.type = type;
			entity.organization = organization;
			entity.tenant = tenant;
			tagTypes.push(entity);
		}
	});
	return insertLevels(dataSource, tagTypes);
};

const insertLevels = async (dataSource: DataSource, tagTypes: TagType[]) => await dataSource.manager.save(tagTypes);
