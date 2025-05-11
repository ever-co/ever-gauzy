import { ZObject, Bundle } from 'zapier-platform-core';

interface Project {
  id: string;
  name: string;
  [key: string]: any;
}

const perform = async (z: ZObject, bundle: Bundle) => {
  const organizationId = bundle.inputData.organizationId;

  if (!organizationId) {
    throw new Error('Organization ID is required');
  }

  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    const response = await z.request({
      url: `${baseUrl}/api/organization-projects`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bundle.authData.access_token}`,
      },
      params: { organizationId },
    });

    if (!response.data || !Array.isArray(response.data.items)) {
      throw new Error('Unexpected API response format');
    }

    return response.data.items.map((project: Project) => ({
      id: project.id,
      name: project.name,
    }));
  } catch (error: any) {
    z.console.error('Error fetching projects:', error);
    throw new Error(`Failed to fetch projects: ${error.message || 'Unknown error'}`);
  }
};

export default {
  key: 'project_list',
  noun: 'Project',
  display: {
    label: 'Project List',
    description: 'Gets a list of projects.',
    hidden: true, // Hidden from the UI as it's just for dynamic dropdowns
  },
  operation: {
    inputFields: [
      {
        key: 'organizationId',
        type: 'string',
        label: 'Organization',
        required: true,
        dynamic: 'organization_list.id.name',
        helpText: 'Select the organization to get projects for',
      },
    ],
    perform,
    sample: {
      id: '29bd6ac8-1408-4933-a8db-f50740a994b8',
      name: 'Sample Project',
    },
  },
};
