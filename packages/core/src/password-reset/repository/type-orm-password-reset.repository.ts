import { Repository } from 'typeorm';
import { PasswordReset } from '../password-reset.entity';

export class TypeOrmPasswordResetRepository extends Repository<PasswordReset> { }