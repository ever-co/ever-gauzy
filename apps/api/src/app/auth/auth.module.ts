
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { RoleService, Role } from '../role';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Role]),
        CqrsModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, UserService, RoleService, ...CommandHandlers],
    exports: [AuthService],
})
export class AuthModule { }
