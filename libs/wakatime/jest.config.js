module.exports = {
	displayName: 'wakatime',
	preset: '../../jest.preset.js',
	globals: {
		'ts-jest': {
			tsConfig: '<rootDir>/tsconfig.spec.json'
		}
	},
	testEnvironment: 'node',
	transform: {
		'^.+\\.[tj]sx?$': 'ts-jest'
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
	coverageDirectory: '../../coverage/libs/wakatime'
};
