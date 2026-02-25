import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactHostDirective } from '@gauzy/ui-react-bridge';
import { ExampleReactWidget, ExampleReactCard } from './react-components';

/**
 * Example page component that demonstrates multiple ways to render React components in Angular.
 */
@Component({
	selector: 'gz-example-react-page',
	standalone: true,
	imports: [CommonModule, ReactHostDirective],
	template: `
		<div class="example-react-page">
			<h2>React Integration Examples</h2>
			<p class="subtitle">
				This page demonstrates rendering React components inside Angular using &#64;gauzy/ui-react-bridge
			</p>

			<div class="section">
				<h3>1. Interactive React Widget</h3>
				<p class="description">A React component with state, effects, and Angular Router integration</p>
				<div [reactHost]="exampleWidget" [props]="widgetProps"></div>
			</div>

			<div class="section">
				<h3>2. React Cards with Dynamic Props</h3>
				<p class="description">Multiple React card components receiving props from Angular</p>
				<div class="cards-grid">
					@for (card of cards; track card.title) {
						<div [reactHost]="cardComponent" [props]="card"></div>
					}
				</div>
			</div>

			<div class="section">
				<h3>3. React with Extra Context</h3>
				<p class="description">Passing additional context to React components</p>
				<div
					[reactHost]="exampleWidget"
					[props]="{ title: 'With Custom Context' }"
					[context]="customContext"
				></div>
			</div>
		</div>
	`,
	styles: [
		`
			.example-react-page {
				padding: 24px;
				max-width: 1200px;
				margin: 0 auto;
			}

			h2 {
				margin: 0 0 8px;
				color: #222b45;
			}

			.subtitle {
				color: #8f9bb3;
				margin-bottom: 32px;
			}

			.section {
				margin-bottom: 32px;
			}

			.section h3 {
				margin: 0 0 8px;
				color: #222b45;
			}

			.description {
				color: #8f9bb3;
				font-size: 14px;
				margin-bottom: 16px;
			}

			.cards-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 16px;
			}
		`
	]
})
export class ExampleReactPageComponent {
	// React components to render
	exampleWidget = ExampleReactWidget;
	cardComponent = ExampleReactCard;

	// Props for the widget
	widgetProps = {
		title: 'Interactive Counter',
		description: 'Click the buttons to change the count. Uses React useState and Angular Router.'
	};

	// Cards data
	cards = [
		{ title: 'Total Users', value: '1,234', icon: '👥', color: '#3366ff' },
		{ title: 'Revenue', value: '$45,678', icon: '💰', color: '#00d68f' },
		{ title: 'Orders', value: '892', icon: '📦', color: '#ffaa00' },
		{ title: 'Growth', value: '+23%', icon: '📈', color: '#ff3d71' }
	];

	// Custom context to pass to React
	customContext = {
		theme: 'light',
		locale: 'en-US',
		featureFlags: {
			newDashboard: true,
			betaFeatures: false
		}
	};
}
