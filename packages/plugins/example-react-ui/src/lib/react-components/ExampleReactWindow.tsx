import { useState, useEffect } from 'react';
import { Card, Flex, Text, Badge, Box, Spinner, Separator } from '@radix-ui/themes';
import { ClockIcon } from '@radix-ui/react-icons';
import { RadixThemeProvider } from './RadixThemeProvider';

/**
 * Props for the ExampleReactWindow component.
 */
export interface ExampleReactWindowProps {
	/** Window title */
	title: string;
	/** Description text */
	description?: string;
}

/**
 * Task item interface.
 */
interface TaskItem {
	id: number;
	label: string;
	time: string;
	status: 'completed' | 'in-progress' | 'pending';
}

/**
 * Example React window component using Radix UI Themes that demonstrates
 * rendering a larger content panel inside the Angular dashboard.
 *
 * This component shows:
 * - React state management with hooks
 * - Radix UI Themes components (Card, Flex, Text, Badge, Spinner)
 * - Loading states and list rendering
 */
export function ExampleReactWindow({
	title,
	description = 'This window is rendered using React inside the Angular Time Tracking dashboard.'
}: ExampleReactWindowProps) {
	const [items, setItems] = useState<TaskItem[]>([]);
	const [loading, setLoading] = useState(true);

	// Simulate loading data
	useEffect(() => {
		const timer = setTimeout(() => {
			setItems([
				{ id: 1, label: 'Design system review', time: '2h 30m', status: 'completed' },
				{ id: 2, label: 'React bridge implementation', time: '1h 45m', status: 'completed' },
				{ id: 3, label: 'Plugin architecture docs', time: '3h 15m', status: 'in-progress' },
				{ id: 4, label: 'Unit test coverage', time: '0h 55m', status: 'pending' }
			]);
			setLoading(false);
		}, 1000);

		return () => clearTimeout(timer);
	}, []);

	const getStatusBadge = (status: TaskItem['status']) => {
		const colors: Record<TaskItem['status'], 'green' | 'blue' | 'gray'> = {
			completed: 'green',
			'in-progress': 'blue',
			pending: 'gray'
		};
		const labels: Record<TaskItem['status'], string> = {
			completed: 'Done',
			'in-progress': 'Active',
			pending: 'Todo'
		};
		return (
			<Badge color={colors[status]} variant="soft" size="1">
				{labels[status]}
			</Badge>
		);
	};

	return (
		<RadixThemeProvider appearance="light" accentColor="blue">
			<Card size="3">
				<Flex direction="column" gap="4">
					{/* Header */}
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<ClockIcon width="20" height="20" />
							<Text size="4" weight="bold">
								{title}
							</Text>
						</Flex>
						<Badge color="blue" variant="surface">
							React
						</Badge>
					</Flex>

					{/* Description */}
					{description && (
						<Text as="p" size="2" color="gray">
							{description}
						</Text>
					)}

					<Separator size="4" />

					{/* Content */}
					{loading ? (
						<Flex align="center" justify="center" py="6">
							<Spinner size="3" />
							<Text size="2" color="gray" ml="2">
								Loading tasks...
							</Text>
						</Flex>
					) : (
						<Flex direction="column" gap="2">
							{items.map((item, index) => (
								<Box key={item.id}>
									<Flex align="center" justify="between" py="2">
										<Flex direction="column" gap="1">
											<Text size="2" weight="medium">
												{item.label}
											</Text>
											<Flex align="center" gap="1">
												<ClockIcon width="12" height="12" />
												<Text size="1" color="gray">
													{item.time}
												</Text>
											</Flex>
										</Flex>
										{getStatusBadge(item.status)}
									</Flex>
									{index < items.length - 1 && <Separator size="4" />}
								</Box>
							))}
						</Flex>
					)}

					{/* Footer summary */}
					{!loading && (
						<Flex align="center" justify="between" pt="2">
							<Text size="1" color="gray">
								{items.length} tasks total
							</Text>
							<Text size="1" color="green" weight="medium">
								{items.reduce((acc, item) => {
									const [h, m] = item.time.replace('h', '').replace('m', '').split(' ').map(Number);
									return acc + h * 60 + m;
								}, 0) / 60}h tracked
							</Text>
						</Flex>
					)}
				</Flex>
			</Card>
		</RadixThemeProvider>
	);
}

export default ExampleReactWindow;
