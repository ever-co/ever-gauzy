import { Tag } from './tag.entity';

/**
 * Represents an entity that can be tagged with multiple tags.
 */
export interface Taggable {
	/**
	 * An array of tags associated with the entity.
	 */
	tags?: Tag[];
}
