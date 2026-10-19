import {
	NodeConnectionTypes,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import { checkResponse, contentsToItems, urlsToItems } from './GenericFunctions';

const show = (...operation: string[]) => ({ show: { operation } });

// Expressions that turn a text field into the array the API expects. An empty field sends nothing.
const list = (separator: string) =>
	`={{ (a => a.length ? a : undefined)(String($value ?? "").split(${separator}).map(s => s.trim()).filter(s => s)) }}`;
const LINES = list('"\\n"');
const COMMAS = list('","');
// Whitespace, or a comma that starts the next URL, so a comma inside one URL is kept.
const URL_LIST = list('/\\s+|,(?=\\s*https?:\\/\\/)/');

const body = (property: string, value?: string) => ({
	send: { type: 'body' as const, property, ...(value && { value }) },
});

const pathFilters: INodeProperties[] = [
	{
		displayName: 'Include Paths',
		name: 'includePaths',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		placeholder: 'e.g. /docs/',
		description: 'Regexes matched against the URL path, one per line (up to 20). Only matching URLs are kept.',
		routing: body('includePaths', LINES),
	},
	{
		displayName: 'Exclude Paths',
		name: 'excludePaths',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		placeholder: 'e.g. /blog/',
		description: 'Regexes matched against the URL path, one per line (up to 20). Matching URLs are skipped.',
		routing: body('excludePaths', LINES),
	},
];

const properties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Answer',
				value: 'answer',
				action: 'Answer question from web pages',
				description:
					'Search, then quote the most relevant passages from the top pages, each with a citation. No text is generated.',
				routing: {
					request: { method: 'POST', url: '/v1/answer' },
					output: { postReceive: [checkResponse] },
				},
			},
			{
				name: 'Crawl',
				value: 'crawl',
				action: 'Crawl website',
				description:
					'Follow same-site links from a start URL and get every page as Markdown. 1 credit per page returned.',
				routing: {
					request: { method: 'POST', url: '/v1/crawl' },
					output: {
						postReceive: [checkResponse, { type: 'rootProperty', properties: { property: 'results' } }],
					},
				},
			},
			{
				name: 'Get Contents',
				value: 'getContents',
				action: 'Get page contents as markdown',
				description: 'Fetch one or more pages as Markdown. 1 credit per page that loads.',
				routing: {
					request: { method: 'POST', url: '/v1/contents' },
					output: { postReceive: [checkResponse, contentsToItems] },
				},
			},
			{
				name: 'Map',
				value: 'map',
				action: 'Map website urls',
				description: "List a site's URLs from its links and sitemaps without fetching the pages",
				routing: {
					request: { method: 'POST', url: '/v1/map' },
					output: { postReceive: [checkResponse, urlsToItems] },
				},
			},
			{
				name: 'Research',
				value: 'research',
				action: 'Research topic',
				description:
					'Run up to 5 searches at once and get one evidence pack of quoted, numbered sources. 1 credit per search.',
				routing: {
					request: { method: 'POST', url: '/v1/research' },
					output: { postReceive: [checkResponse] },
				},
			},
			{
				name: 'Search',
				value: 'search',
				action: 'Search web',
				description: 'Search the web and get results with page Markdown, highlights or pruned context',
				routing: {
					request: { method: 'POST', url: '/v1/search' },
					output: {
						postReceive: [checkResponse, { type: 'rootProperty', properties: { property: 'results' } }],
					},
				},
			},
		],
		default: 'search',
	},

	// Search
	{
		displayName: 'Query',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. best vector database 2026',
		description: 'What to search the web for (up to 2,000 characters)',
		displayOptions: show('search'),
		routing: body('query'),
	},
	{
		displayName: 'Max Results',
		name: 'numResults',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 25 },
		default: 5,
		description: 'Max number of results to return',
		displayOptions: show('search'),
		routing: body('numResults'),
	},
	{
		displayName: 'Page Content',
		name: 'contents',
		type: 'multiOptions',
		options: [
			{ name: 'Full Text', value: 'text', description: 'The whole page as Markdown' },
			{ name: 'Highlights', value: 'highlights', description: 'The page chunks most relevant to the query' },
			{
				name: 'Pruned Context',
				value: 'prunedContext',
				description: 'The relevant chunks joined in page order, to save tokens',
			},
		],
		default: ['prunedContext'],
		description: 'What page content to add to each result. With none, results have only title, URL and score.',
		displayOptions: show('search'),
		routing: body(
			'contents',
			'={{ { text: $value.includes("text"), highlights: $value.includes("highlights"), pruned_context: $value.includes("prunedContext") } }}',
		),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('search'),
		options: [
			{
				displayName: 'Exclude Domains',
				name: 'excludeDomains',
				type: 'string',
				default: '',
				placeholder: 'e.g. pinterest.com, quora.com',
				description: 'Comma-separated domains to leave out of the results',
				routing: body('excludeDomains', COMMAS),
			},
			{
				displayName: 'Include Domains',
				name: 'includeDomains',
				type: 'string',
				default: '',
				placeholder: 'e.g. docs.python.org, github.com',
				description: 'Comma-separated domains. Only results from these domains are returned.',
				routing: body('includeDomains', COMMAS),
			},
			{
				displayName: 'Published After',
				name: 'startPublishedDate',
				type: 'dateTime',
				default: '',
				description: 'Only return results published on or after this date',
				routing: body('startPublishedDate'),
			},
		],
	},

	// Get Contents
	{
		displayName: 'URLs',
		name: 'urls',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://example.com/page',
		description: 'One or more page URLs (up to 10), separated by commas or new lines',
		displayOptions: show('getContents'),
		routing: body('urls', URL_LIST),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('getContents'),
		options: [
			{
				displayName: 'Full Text',
				name: 'text',
				type: 'boolean',
				default: true,
				description: 'Whether to return each page as Markdown',
				routing: body('text'),
			},
			{
				displayName: 'Highlights Query',
				name: 'highlightsQuery',
				type: 'string',
				default: '',
				placeholder: 'e.g. pricing',
				description: 'Return the page chunks most relevant to this query as highlights',
				routing: body('highlights', '={{ { query: $value } }}'),
			},
			{
				displayName: 'Pruned Context',
				name: 'prunedContext',
				type: 'boolean',
				default: false,
				description:
					"Whether to return the chunks relevant to 'Highlights Query' joined in page order, to save tokens",
				routing: body('pruned_context'),
			},
		],
	},

	// Answer
	{
		displayName: 'Question',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. how do I cancel an asyncio task after a timeout?',
		description: 'The question to answer from web pages',
		displayOptions: show('answer'),
		routing: body('query'),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('answer'),
		options: [
			{
				displayName: 'Include Page Text',
				name: 'text',
				type: 'boolean',
				default: false,
				description: "Whether to add each citation's full page text",
				routing: body('text'),
			},
			{
				displayName: 'Pages to Search',
				name: 'numResults',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 10 },
				default: 5,
				description: 'How many top pages to take passages from',
				routing: body('numResults'),
			},
		],
	},

	// Research
	{
		displayName: 'Question',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. python asyncio timeout',
		description: 'The research question. Results are ranked and pruned against it.',
		displayOptions: show('research'),
		routing: body('query'),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('research'),
		options: [
			{
				displayName: 'Results Per Search',
				name: 'numResultsPerQuery',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 10 },
				default: 5,
				description: 'Results each search returns',
				routing: body('numResultsPerQuery'),
			},
			{
				displayName: 'Searches',
				name: 'subQueries',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				placeholder: 'e.g. python asyncio timeout documentation',
				description:
					'Up to 5 searches to run, one per line. Leave empty to derive them from the question. 1 credit per search.',
				routing: body('subQueries', LINES),
			},
		],
	},

	// Crawl and Map
	{
		displayName: 'URL',
		name: 'url',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. https://docs.python.org/3/library/asyncio.html',
		description: 'Public http(s) start URL. Only links on the same site are followed.',
		displayOptions: show('crawl', 'map'),
		routing: body('url'),
	},
	{
		displayName: 'Max Pages',
		name: 'maxPages',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		default: 10,
		description: 'Max number of pages to return. 1 credit per page returned.',
		displayOptions: show('crawl'),
		routing: body('limit'),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('crawl'),
		options: [
			...pathFilters,
			{
				displayName: 'Max Depth',
				name: 'maxDepth',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 3 },
				default: 1,
				description: 'Link hops from the start URL',
				routing: body('maxDepth'),
			},
			{
				displayName: 'Max Links Per Page',
				name: 'maxBreadth',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 20,
				description: 'New links followed from each page',
				routing: body('maxBreadth'),
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'e.g. timeouts',
				description: 'Rank the pages by this query and prune each one to it',
				routing: body('query'),
			},
		],
	},
	{
		displayName: 'Max URLs',
		name: 'maxUrls',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 5000 },
		default: 100,
		description: 'Max number of URLs to return',
		displayOptions: show('map'),
		routing: body('limit'),
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('map'),
		options: pathFilters,
	},
];

export class ContextFetch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ContextFetch',
		name: 'contextFetch',
		icon: { light: 'file:../../icons/contextfetch.svg', dark: 'file:../../icons/contextfetch.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Search the web and read pages as Markdown with the ContextFetch API',
		defaults: {
			name: 'ContextFetch',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'contextFetchApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: '={{ ($credentials.baseUrl || "https://api.contextfetch.dev").replace(/\\/+$/, "") }}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			// checkResponse turns HTTP errors into messages with next steps (and the 402 payment link).
			ignoreHttpStatusErrors: true,
		},
		properties,
	};
}
