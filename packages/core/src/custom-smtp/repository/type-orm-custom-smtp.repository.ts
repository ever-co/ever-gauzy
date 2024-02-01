import { Repository } from 'typeorm';
import { CustomSmtp } from '../custom-smtp.entity';

export class TypeOrmCustomSmtpRepository extends Repository<CustomSmtp> { }