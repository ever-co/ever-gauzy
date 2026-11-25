import { toSpeechText } from './MessageActions';

describe('toSpeechText', () => {
	it('drops markdown markup but keeps the words', () => {
		expect(toSpeechText('## Projects\n\n- **Alpha** is _active_\n- See [the board](/pages/tasks)')).toBe(
			'Projects Alpha is active See the board'
		);
	});

	it('skips code blocks and keeps inline code as words', () => {
		expect(toSpeechText('Run `yarn start` first.\n\n```bash\nyarn start\n```\nThen open it.')).toBe(
			'Run yarn start first. Then open it.'
		);
	});

	it('reads a table row by row instead of spelling out its pipes', () => {
		expect(toSpeechText('| Project | Budget |\n|---|---|\n| Alpha | 3 |')).toBe('Project, Budget. Alpha, 3.');
	});
});
