import { ZObject, Bundle } from 'zapier-platform-core';

const perform = async (z: ZObject, bundle: Bundle) => {
    const projectId = bundle.inputData.projectId;

    if(!projectId) {
        throw new Error('Project ID is required')
    }

    try {
        const response = await z.request({
            url: `${process.env.API_BASE_URL}/api/tasks`,
            method: 'GET',
            headers: {
                Authorization: `Bearer ${bundle.authData['access_token']}`,
            },
            params: {
                projectId: projectId
            }
        });

        return response.data.items.map((task: { id: string; title?: string; name?: string }) => ({
            id: task.id,
            name: task.title || task.name
        }));
    } catch (error) {
        z.console.error('Error fetching tasks:', error);
        throw new Error('Failed to fetch tasks');
    }
};

export default {
    key: 'task_list',
    noun: 'Task',
    display: {
        label: 'Task List',
        description: 'Gets a list of tasks for dynamic dropdown selection',
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
