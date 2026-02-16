type DeprecatedTokenDto = {
	tokenHash?: string;
	oldTokenHash?: string;
};

type RawTokenDto = {
	rawToken?: string;
	rawOldToken?: string;
};

export function resolveRawToken(dto: RawTokenDto & DeprecatedTokenDto): string {
	if (dto.rawToken) {
		return dto.rawToken;
	}

	if (dto.rawOldToken) {
		return dto.rawOldToken;
	}

	if (dto.tokenHash) {
		return dto.tokenHash;
	}

	if (dto.oldTokenHash) {
		return dto.oldTokenHash;
	}

	throw new Error('A raw JWT token is required');
}
