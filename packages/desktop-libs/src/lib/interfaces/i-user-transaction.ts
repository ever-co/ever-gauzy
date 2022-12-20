import { UserTO } from 'lib/offline/dto/user.dto';
import { ITransaction } from './i-transaction';

export interface IUserTransaction extends ITransaction<UserTO> {}
