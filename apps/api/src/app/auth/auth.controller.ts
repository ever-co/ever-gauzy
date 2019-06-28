
import { Controller, Post, HttpStatus, HttpCode, Body, Get, Req, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { User as IUser } from '../user/user.entity';
import { CommandBus } from '@nestjs/cqrs';
import { AuthRegisterCommand } from './commands';
import { IUserRegistrationInput } from './user-registration-input';
import { RequestContext } from '../core/context';
import { RolesEnum } from '@gauzy/models';

@ApiUseTags('Auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService,
    private readonly commandBus: CommandBus) {

  }

  @ApiOperation({ title: 'Is authenticated' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST })
  @Get('/authenticated')
  async authenticated(): Promise<boolean> {
    const token = RequestContext.currentToken();

    return this.authService.isAuthenticated(token);
  }

  @ApiOperation({ title: 'Has role?' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST })
  @Get('/role')
  async hasRole(@Query('roles') roles: string[]): Promise<boolean> {
    const token = RequestContext.currentToken();

    return this.authService.hasRole(token, roles);
  }

  @ApiOperation({ title: 'Create new record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' /*, type: T*/ })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input, The response body may contain clues as to what went wrong',
  })
  @Post('/register')
  async create(@Body() entity: IUserRegistrationInput, ...options: any[]): Promise<IUser> {
    return this.commandBus.execute(
      new AuthRegisterCommand(entity)
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('/login')
  async login(@Body() { findObj, password }, ...options: any[]): Promise<{ user: IUser; token: string } | null> {
    return this.authService.login(findObj, password)
  }
}
