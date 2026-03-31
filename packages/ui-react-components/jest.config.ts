export default {
	displayName: 'ui-react-components',
	preset: '../../jest.preset.js',
	testEnvironment: 'jsdom',
	transform: {
		'^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
	},
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
	coverageDirectory: '../../coverage/packages/ui-react-components'
};
