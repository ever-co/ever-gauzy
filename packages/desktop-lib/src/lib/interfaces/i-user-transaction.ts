import { UserTO } from '../offline/dto/user.dto';
import { ITransaction } from './i-transaction';

export interface IUserTransaction extends ITransaction<UserTO> {}
