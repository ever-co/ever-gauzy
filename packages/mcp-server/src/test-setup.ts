// Required by mcp-server environment validation when tool modules are imported in tests.
// Kept out of jest.config.ts: the static-checks `typecheck-configs` job compiles every jest config
// without Node types, so a config cannot reference `process`.
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
process.env.GAUZY_AUTO_LOGIN = process.env.GAUZY_AUTO_LOGIN || 'false';
