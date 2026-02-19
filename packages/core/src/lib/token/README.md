# Token Management Module for NestJS

A rotational JWT token management module built with NestJS, TypeORM, and CQRS pattern. This module provides a solid foundation for managing various token types (refresh tokens, access tokens, invitation tokens, password reset tokens, etc.) with built-in security, concurrency control, and extensibility.

## Features

**SOLID Principles**: Clean architecture following all SOLID principles
**CQRS Pattern**: Separate commands and queries for better scalability
**Concurrency Safe**: Pessimistic and optimistic locking for atomic updates
**Token Rotation**: Secure token rotation with audit trail
**Automatic Cleanup**: Scheduled tasks for expired and inactive tokens
**Extensible**: Easy to add new token types without modifying core logic
**Audit Trail**: Complete history tracking with rotation chains
**Type Safe**: Full TypeScript support with interfaces
**Database Agnostic**: Works with any TypeORM-supported database

## Architecture

### SOLID Principles Implementation

1. **Single Responsibility Principle (SRP)**

    - Each handler does one thing: create, rotate, validate, or revoke tokens
    - Repositories handle only data access
    - Services orchestrate commands/queries

2. **Open/Closed Principle (OCP)**

    - Token types are registered via `TokenConfigRegistry`
    - New token types can be added without modifying existing code
    - Extension through composition, not inheritance

3. **Liskov Substitution Principle (LSP)**

    - Interface-based design (`ITokenRepository`, `IJwtService`)
    - Implementations are interchangeable

4. **Interface Segregation Principle (ISP)**

    - Focused interfaces for specific responsibilities
    - Clients depend only on interfaces they use

5. **Dependency Inversion Principle (DIP)**
    - Depend on abstractions (interfaces), not concrete implementations
    - Dependency injection throughout

## Installation

```bash
npm install @nestjs/common @nestjs/core @nestjs/cqrs @nestjs/typeorm @nestjs/schedule typeorm jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

## Quick Start

### 1. Import the Module

```typescript
import { Module } from '@nestjs/common';
import { TokenModule } from './token-module';

@Module({
	imports: [
		TokenModule.forRoot({
			enableScheduler: true // Enable automatic cleanup
		})
	]
})
export class AppModule {}
```

### 2. Create a Token Type Module

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { TokenModule } from './token-module';
import { TokenConfigRegistry } from './token-module/services/token-config.registry';

export const REFRESH_TOKEN_TYPE = 'REFRESH_TOKEN';

@Module({
	imports: [TokenModule.forFeature()]
})
export class RefreshTokenModule implements OnModuleInit {
	constructor(private readonly configRegistry: TokenConfigRegistry) {}

	onModuleInit() {
		this.configRegistry.register({
			tokenType: REFRESH_TOKEN_TYPE,
			expirationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
			inactivityThresholdMs: 7 * 24 * 60 * 60 * 1000, // 7 days
			allowRotation: true,
			allowMultipleSessions: false
		});
	}
}
```

### 3. Use in Your Service

```typescript
import { Injectable } from '@nestjs/common';
import { TokenService } from './token-module/services/token.service';

@Injectable()
export class AuthService {
	constructor(private readonly tokenService: TokenService) {}

	async login(userId: string) {
		const token = await this.tokenService.createToken({
			userId,
			tokenType: 'REFRESH_TOKEN',
			metadata: { deviceId: 'device-123' }
		});

		return token.token;
	}

	async validateToken(tokenString: string) {
		const result = await this.tokenService.validateToken({
			tokenHash: tokenString,
			tokenType: 'REFRESH_TOKEN',
			checkInactivity: true
		});

		return result.isValid;
	}

	async rotateToken(oldToken: string, userId: string) {
		const newToken = await this.tokenService.rotateToken({
			oldTokenHash: oldToken,
			userId,
			tokenType: 'REFRESH_TOKEN'
		});

		return newToken.token;
	}
}
```

## Core Concepts

### Token Configuration

Each token type requires a configuration:

```typescript
interface ITokenConfig {
	tokenType: string; // Unique identifier
	expirationMs?: number; // Expiration time in ms (null = never)
	inactivityThresholdMs?: number; // Inactivity timeout (null = no check)
	allowRotation: boolean; // Can tokens be rotated?
	allowMultipleSessions: boolean; // Multiple tokens per user?
	maxUsageCount?: number; // Max times token can be used
}
```

### Token Lifecycle

1. **Creation** → Token is generated with JWT and stored in database
2. **Validation** → JWT verified, database checked for status
3. **Usage** → `lastUsedAt` and `usageCount` updated
4. **Rotation** → Old token marked as ROTATED, new token created
5. **Revocation** → Token marked as REVOKED with reason
6. **Expiration** → Scheduled job marks expired tokens

### Concurrency Control

**Pessimistic Locking** (for rotation):

```typescript
// Locks the row during rotation to prevent race conditions
const token = await this.tokenRepository.findByHashWithLock(tokenHash);
```

**Optimistic Locking** (for updates):

```typescript
// Uses version field to detect concurrent modifications
await this.tokenRepository.updateStatus(tokenId, status, version);
```

## Token Types Examples

### Refresh Token

-   Long-lived (30 days)
-   Supports rotation
-   Single session per user
-   Inactivity timeout

### Access Token

-   Short-lived (15 minutes)
-   No rotation (refreshed instead)
-   Multiple sessions allowed
-   No inactivity check

### Invitation Token

-   Medium-lived (7 days)
-   One-time use
-   No rotation
-   Single invitation per user

### Password Reset Token

-   Short-lived (1 hour)
-   One-time use
-   No rotation
-   Single token per user

## API Reference

### TokenService Methods

#### createToken(dto: ICreateTokenDto): Promise<IGeneratedToken>

Creates a new token.

#### rotateToken(dto: IRotateTokenDto): Promise<IGeneratedToken>

Rotates an existing token (creates new, marks old as rotated).

#### revokeToken(dto: IRevokeTokenDto): Promise<void>

Revokes a specific token.

#### revokeAllUserTokens(userId, tokenType, revokedBy?, reason?): Promise<number>

Revokes all active tokens for a user by type.

#### validateToken(dto: IValidateTokenDto): Promise<IValidatedToken>

Validates a token and returns payload if valid.

#### getTokenById(tokenId: string): Promise<ITokenEntity>

Retrieves token details by ID.

#### getActiveTokens(userId, tokenType): Promise<ITokenEntity[]>

Gets all active tokens for a user by type.

#### queryTokens(filters, limit?, offset?): Promise<ITokenQueryResult>

Queries tokens with filters and pagination.

#### getTokenAuditTrail(tokenId): Promise<ITokenEntity[]>

Gets complete rotation history for a token.

## Database Schema

```sql
CREATE TABLE tokens (
  id UUID PRIMARY KEY,
  token_hash VARCHAR(255) NOT NULL,
  token_type VARCHAR(50) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  status ENUM('ACTIVE', 'REVOKED', 'EXPIRED', 'ROTATED'),
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  usage_count INT DEFAULT 0,
  rotated_from_token_id UUID,
  rotated_to_token_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  revoked_reason VARCHAR(255),
  revoked_by VARCHAR(255),
  metadata JSONB,
  version INT DEFAULT 1
);

-- Indices for performance
CREATE INDEX idx_token_hash ON tokens(token_hash);
CREATE INDEX idx_user_type_status ON tokens(user_id, token_type, status);
CREATE INDEX idx_expires_at ON tokens(expires_at);
```

## Environment Variables

```bash
JWT_SECRET=your-secret-key-here
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=token_db
```

## Testing

### Unit Tests

```typescript
describe('TokenService', () => {
	let service: TokenService;
	let repository: ITokenRepository;

	beforeEach(async () => {
		const module = await Test.createTestingModule({
			providers: [
				TokenService,
				{ provide: 'ITokenRepository', useValue: mockRepository },
				{ provide: 'IJwtService', useValue: mockJwtService },
				{ provide: 'ITokenHasher', useValue: mockTokenHasher }
			]
		}).compile();

		service = module.get<TokenService>(TokenService);
	});

	it('should create a token', async () => {
		const result = await service.createToken({
			userId: 'user-123',
			tokenType: 'TEST_TOKEN'
		});

		expect(result.token).toBeDefined();
		expect(result.tokenId).toBeDefined();
	});
});
```

### Integration Tests

```typescript
describe('Token Rotation (Integration)', () => {
	it('should rotate token atomically', async () => {
		const original = await tokenService.createToken({
			userId: 'user-123',
			tokenType: 'REFRESH_TOKEN'
		});

		const rotated = await tokenService.rotateToken({
			oldTokenHash: original.token,
			userId: 'user-123',
			tokenType: 'REFRESH_TOKEN'
		});

		// Original should be marked as rotated
		const oldToken = await tokenService.getTokenById(original.tokenId);
		expect(oldToken.status).toBe(TokenStatus.ROTATED);
		expect(oldToken.rotatedToTokenId).toBe(rotated.tokenId);
	});
});
```

## Performance Considerations

1. **Indexing**: Critical indices on `token_hash`, `user_id`, `token_type`, `status`
2. **Locking Strategy**: Pessimistic locking only for rotation, not for validation
3. **Caching**: Consider Redis for frequently validated tokens
4. **Cleanup**: Scheduled jobs run hourly (expired) and every 6 hours (inactive)
5. **Pagination**: Use `queryTokens` with limit/offset for large result sets

## Security Best Practices

1. **Hash Tokens**: Never store raw JWT in database
2. **Short Expiration**: Keep access tokens short-lived
3. **Rotation**: Implement token rotation for refresh tokens
4. **Revocation**: Revoke all tokens on password change
5. **Audit Trail**: Monitor suspicious token activity
6. **Rate Limiting**: Implement rate limiting on token endpoints

## Contributing

Contributions are welcome! This module follows:

-   SOLID principles
-   CQRS pattern
-   Clean architecture
-   TypeScript strict mode
-

## Security Best Practices

1. **Hash Tokens**: Never store raw JWT in database
2. **Short Expiration**: Keep access tokens short-lived
3. **Rotation**: Implement token rotation for refresh tokens
4. **Revocation**: Revoke all tokens on password change
5. **Audit Trail**: Monitor suspicious token activity
6. **Rate Limiting**: Implement rate limiting on token endpoints

## Contributing

Contributions are welcome! This module follows:

-   SOLID principles
-   CQRS pattern
-   Clean architecture
-   TypeScript strict mode
-   Comprehensive testing

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
