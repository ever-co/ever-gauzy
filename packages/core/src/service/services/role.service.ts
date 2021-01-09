import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config';

@Injectable()
export class RoleService {
  constructor(private configService: ConfigService) {}
}
