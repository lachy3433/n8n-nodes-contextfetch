import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ContextFetchApi implements ICredentialType {
	name = 'contextFetchApi';

	displayName = 'ContextFetch API';

	icon: Icon = { light: 'file:../icons/contextfetch.svg', dark: 'file:../icons/contextfetch.dark.svg' };

	documentationUrl = 'https://contextfetch.dev/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your ContextFetch API key. Get a free key with 2,500 credits: POST https://api.contextfetch.dev/v1/keys/free.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.contextfetch.dev',
			description: 'Change this only to use another ContextFetch API host',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// GET /v1/balance costs no credits and answers 401 for an unknown key.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ ($credentials.baseUrl || "https://api.contextfetch.dev").replace(/\\/+$/, "") }}',
			url: '/v1/balance',
			method: 'GET',
		},
	};
}
