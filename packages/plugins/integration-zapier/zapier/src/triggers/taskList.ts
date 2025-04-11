import { ZObject, Bundle } from 'zapier-platform-core';

interface Task {
    id: string;
    title?: string;
    name?: string;
    [key: string]: any;
}

const perform = async (z: ZObject, bundle: Bundle) => {
    const projectId = bundle.inputData.projectId;

    if (!projectId) {
        throw new Error('Project ID is required');
    }

    try {
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
        const response = await z.request({
            url: `${baseUrl}/api/tasks`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${bundle.authData.access_token}`,
            },
            params: { projectId }
        });

        // Check if response data is in expected format
        if (response.data?.items) {
            return response.data.items.map((task: Task) => ({
                id: task.id,
                name: task.title || task.name
            }));
        }
        throw new Error('Failed to fetch tasks');
    } catch (error: any) {
        z.console.error('Error fetching tasks:', error);
        throw new Error(`Failed to fetch tasks: ${error.message || 'Unknown error'}`);
    }
};

export default {
    key: 'task_list',
    noun: 'Task',
    display: {
        label: 'Task List',
        description: 'Gets a list of tasks for dynamic dropdown selection.',
        hidden: true, // Hidden from the UI as it's just for dynamic dropdowns
    },
    operation: {
        inputFields: [
            {
                key: 'projectId',
                type: 'string',
                label: 'Project',
                required: true,
                dynamic: 'project_list.id.name',
                helpText: 'Select the project to get tasks for'
            }
        ],
        perform,
        sample: {
            id: '0e6ac2e7-0094-4166-852e-62bf1731ecfb',
            name: 'Sample Task'
        }
    }
};
