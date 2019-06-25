
import { Controller, Get, Post, HttpStatus, HttpCode, Body } from '@nestjs/common';
import {  ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { DeepPartial } from 'typeorm/common/DeepPartial';

@ApiUseTags('Auth')
@Controller()
export class AuthController  {
  constructor(private readonly authService: AuthService) {
  
  }

  @ApiOperation({ title: 'Create new record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' /*, type: T*/ })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input, The response body may contain clues as to what went wrong',
  })

  @HttpCode(HttpStatus.CREATED)
  @Post('/register')
  async create(@Body() entity, ...options: any[]): Promise<User> {
    return this.authService.register(entity)
  }

  @HttpCode(HttpStatus.OK)
  @Post('/login')
  async login(@Body() {findObj, password}, ...options: any[]): Promise<{ user: User; token: string } | null>  {
    return this.authService.login(findObj, password)
  }
}
