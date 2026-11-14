import 'reflect-metadata';
import { TokenStatus } from '../../interfaces/token.interface';
import { RevokeTokenByIdCommand } from '../revoke-token-by-id.command';
import { TouchTokenCommand } from '../touch-token.command';
import { RevokeTokenByIdHandler } from './revoke-token-by-id-command.handler';
import { TouchTokenHandler } from './touch-token-command.handler';

interface Row {
	id: string;
	userId: string;
	tokenType: string;
	status: TokenStatus;
	expiresAt: Date | null;
	revokedAt: Date | null;
	version: number;
	lastUsedAt?: Date | null;
	revokedById?: string;
	revokedReason?: string;
}

const future = () => new Date(Date.now() + 60 * 60 * 1000);

/** A token table with the repository calls the two handlers make, as plain rows (the MikroORM shape). */
function table(rows: Row[]) {
	const read = {
		findById: jest.fn(async (id: string) => {
			const row = rows.find((candidate) => candidate.id === id);
			return row ? { ...row } : null;
		})
	};
	const write = {
		updateStatus: jest.fn(async (id: string, status: TokenStatus, version: number, extra: Partial<Row>) => {
			const row = rows.find((candidate) => candidate.id === id && candidate.version === version);
			if (!row) {
				return false;
			}
			Object.assign(row, extra, { status, version: row.version + 1 });
			return true;
		}),
		updateLastUsed: jest.fn(async (id: string) => {
			const row = rows.find((candidate) => candidate.id === id);
			if (row) {
				row.lastUsedAt = new Date();
			}
		})
	};
	return { read, write };
}

function activeRow(overrides: Partial<Row> = {}): Row {
	return {
		id: 'token-1',
		userId: 'marie',
		tokenType: 'REFRESH_TOKEN_TYPE',
		status: TokenStatus.ACTIVE,
		expiresAt: future(),
		revokedAt: null,
		version: 1,
		...overrides
	};
}

const command = (overrides: Partial<RevokeTokenByIdCommand['dto']> = {}) =>
	new RevokeTokenByIdCommand({
		tokenId: 'token-1',
		userId: 'marie',
		tokenType: 'REFRESH_TOKEN_TYPE',
		revokedById: 'marie',
		reason: 'Signed out from another session',
		...overrides
	});

describe('RevokeTokenByIdHandler', () => {
	it('revokes an active token of the user and the type, with who and why', async () => {
		const rows = [activeRow()];
		const { read, write } = table(rows);
		const handler = new RevokeTokenByIdHandler(read as any, write as any);

		await expect(handler.execute(command())).resolves.toBe(true);

		expect(rows[0].status).toBe(TokenStatus.REVOKED);
		expect(rows[0].revokedById).toBe('marie');
		expect(rows[0].revokedReason).toBe('Signed out from another session');
	});

	it("leaves another user's token alone", async () => {
		const rows = [activeRow({ userId: 'paul' })];
		const { read, write } = table(rows);
		const handler = new RevokeTokenByIdHandler(read as any, write as any);

		await expect(handler.execute(command())).resolves.toBe(false);

		expect(rows[0].status).toBe(TokenStatus.ACTIVE);
		expect(write.updateStatus).not.toHaveBeenCalled();
	});

	it('leaves a token of another type alone', async () => {
		const rows = [activeRow({ tokenType: 'ACCESS_TOKEN_TYPE' })];
		const { read, write } = table(rows);
		const handler = new RevokeTokenByIdHandler(read as any, write as any);

		await expect(handler.execute(command())).resolves.toBe(false);

		expect(rows[0].status).toBe(TokenStatus.ACTIVE);
	});

	it('leaves a token that is no longer active as it is', async () => {
		const rows = [activeRow({ status: TokenStatus.ROTATED })];
		const { read, write } = table(rows);
		const handler = new RevokeTokenByIdHandler(read as any, write as any);

		await expect(handler.execute(command())).resolves.toBe(false);

		expect(rows[0].status).toBe(TokenStatus.ROTATED);
		expect(write.updateStatus).not.toHaveBeenCalled();
	});

	it('revokes the token even when a use was recorded between its read and its write', async () => {
		const rows = [activeRow()];
		const { read, write } = table(rows);
		// The use JwtStrategy records bumps the version, as both ORMs' updates do, once, right after the first read.
		const realFind = read.findById.getMockImplementation();
		let interleaved = false;
		read.findById.mockImplementation(async (id: string) => {
			const found = await realFind(id);
			if (!interleaved) {
				interleaved = true;
				rows[0].version += 1;
			}
			return found;
		});
		const handler = new RevokeTokenByIdHandler(read as any, write as any);

		await expect(handler.execute(command())).resolves.toBe(true);

		expect(rows[0].status).toBe(TokenStatus.REVOKED);
	});

	it('answers false for an id that names no token', async () => {
		const { read, write } = table([]);
		const handler = new RevokeTokenByIdHandler(read as any, write as any);

		await expect(handler.execute(command({ tokenId: 'missing' }))).resolves.toBe(false);
	});
});

describe('TouchTokenHandler', () => {
	it("sets the token's last use to now", async () => {
		const rows = [activeRow({ lastUsedAt: new Date('2026-01-01T00:00:00Z') })];
		const { write } = table(rows);
		const handler = new TouchTokenHandler(write as any);

		await handler.execute(new TouchTokenCommand('token-1'));

		expect(write.updateLastUsed).toHaveBeenCalledWith('token-1');
		expect(rows[0].lastUsedAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00Z').getTime());
	});
});
