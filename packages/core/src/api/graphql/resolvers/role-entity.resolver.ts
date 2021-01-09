import { Resolver } from '@nestjs/graphql';
import { RoleService } from '../../../service/services/role.service';

@Resolver('Role')
export class RoleEntityResolver {
  constructor(private roleService: RoleService) {}
}
