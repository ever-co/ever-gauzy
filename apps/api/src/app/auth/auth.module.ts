
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import { UserController } from '../user/user.controller';
import { AuthService } from './auth.service';


@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
    ],
    controllers: [AuthController],
    providers: [AuthService, UserService],
    exports: [AuthService],
})
export class AuthModule { }
