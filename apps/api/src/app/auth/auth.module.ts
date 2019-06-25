
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import { UserController } from '../user/user.controller';
import { AuthService } from './auth.service';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';


@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        CqrsModule
    ],
    controllers: [AuthController],
    providers: [AuthService, UserService, ...CommandHandlers],
    exports: [AuthService],
})
export class AuthModule { }
