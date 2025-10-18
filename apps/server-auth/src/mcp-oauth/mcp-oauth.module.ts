import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { McpOAuthService } from './mcp-oauth.service';

/**
 * MCP OAuth Module
 *
 * This module provides the MCP OAuth service that bridges
 * the OAuth2 authorization server with Gauzy's user management.
 */
@Module({
	imports: [UserModule],
	providers: [McpOAuthService],
	exports: [McpOAuthService]
})
export class McpOAuthModule {}
