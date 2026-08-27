const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

// cspell:ignore disturl nodedir

const { getNativeBuildEnvironment } = require('./postinstall');

test('uses the Node image bundled headers for native rebuilds', () => {
	const nodeRoot = path.resolve('/usr/local');
	const environment = { npm_config_disturl: 'http://127.0.0.1:9' };
	const result = getNativeBuildEnvironment({
		execPath: path.join(nodeRoot, 'bin', 'node'),
		environment,
		fileExists: (candidate) => candidate === path.join(nodeRoot, 'include', 'node', 'node.h')
	});

	assert.deepEqual(result, {
		npm_config_disturl: 'http://127.0.0.1:9',
		npm_config_nodedir: nodeRoot
	});
});

test('preserves the environment when the runtime does not bundle headers', () => {
	const environment = { CI: 'true' };
	const result = getNativeBuildEnvironment({
		execPath: '/opt/node/bin/node',
		environment,
		fileExists: () => false
	});

	assert.equal(result, environment);
});
