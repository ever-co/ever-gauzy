import { useBridgeContext } from '@gauzy/ui-react-bridge';
import { Card, Flex, Text, Badge, Box } from '@radix-ui/themes';
import { RadixThemeProvider } from './RadixThemeProvider';

/**
 * Props for the ExampleReactCard component.
 */
export interface ExampleReactCardProps {
	title: string;
	value: string | number;
	icon?: string;
	color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'cyan' | 'indigo';
	trend?: {
		value: number;
		direction: 'up' | 'down';
	};
}

/**
 * A React stats card component using Radix UI Themes that demonstrates:
 * 1. Receiving props from Angular
 * 2. Using useBridgeContext() for full context access
 * 3. Radix UI Themes Card, Flex, Text components
 */
export function ExampleReactCard({
	title,
	value,
	icon = '📊',
	color = 'blue',
	trend
}: ExampleReactCardProps) {
	// Access the full bridge context (includes injector + any extra context)
	const context = useBridgeContext();

	return (
		<RadixThemeProvider appearance="light" accentColor={color}>
			<Card size="2" style={{ minWidth: '200px' }}>
				<Flex direction="column" gap="3">
					{/* Header with icon and title */}
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Text size="4">{icon}</Text>
							<Text size="2" color="gray" weight="medium">
								{title}
							</Text>
						</Flex>
						<Badge color={color} variant="soft" size="1">
							React
						</Badge>
					</Flex>

					{/* Value */}
					<Text size="7" weight="bold">
						{value}
					</Text>

					{/* Trend indicator */}
					{trend && (
						<Flex align="center" gap="1">
							<Text
								size="2"
								color={trend.direction === 'up' ? 'green' : 'red'}
								weight="medium"
							>
								{trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
							</Text>
							<Text size="1" color="gray">
								vs last period
							</Text>
						</Flex>
					)}

					{/* Footer */}
					<Box>
						<Text size="1" color="gray">
							Rendered by React • Context keys: {Object.keys(context).length}
						</Text>
					</Box>
				</Flex>
			</Card>
		</RadixThemeProvider>
	);
}

export default ExampleReactCard;
