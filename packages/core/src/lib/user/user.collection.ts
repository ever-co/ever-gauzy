import { BaseCollection } from '../core/entities/collection/base.collection';
import { User } from './user.entity';

/**
 * User collection class
 */
export class UserCollection extends BaseCollection<User> {
	constructor(entity: User) {
		super(entity);
	}
}
