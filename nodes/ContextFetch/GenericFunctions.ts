import {
	NodeApiError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type JsonObject,
} from 'n8n-workflow';

const BUY_URL = 'https://api.contextfetch.dev/buy/instant';

interface ErrorBody {
	error?: string;
	message?: string;
	detail?: unknown;
	checkout_url?: string;
	packs?: Array<{ name: string; credits: number; price_usd: number; checkout_url: string }>;
	action?: { url?: string; prompt_to_user?: string };
}

function parseBody(body: IN8nHttpFullResponse['body']): ErrorBody {
	if (typeof body === 'string') {
		try {
			return JSON.parse(body) as ErrorBody;
		} catch {
			return { message: body.slice(0, 300) };
		}
	}
	return body && typeof body === 'object' && !Array.isArray(body) ? (body as ErrorBody) : {};
}

// FastAPI 422 detail: [{loc: ["body", "query"], msg: "..."}] -> "query: ..."
function validationText(detail: unknown): string {
	if (!Array.isArray(detail)) return typeof detail === 'string' ? detail : '';
	return detail
		.map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join('.')}: ${d.msg ?? ''}`)
		.join('; ');
}

/** First postReceive step of every operation: turns an HTTP status of 400 or more into a clear NodeApiError. */
export async function checkResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const status = response.statusCode;
	if (status < 400) return items;

	const body = parseBody(response.body);
	let message = body.message ?? body.error ?? `ContextFetch answered HTTP ${status}`;
	let description: string | undefined;

	if (status === 402) {
		const payUrl = body.action?.url ?? (response.headers['x-payment-url'] as string | undefined) ?? BUY_URL;
		message = `${body.message ?? 'ContextFetch credits ran out.'} Buy credits: ${payUrl}`;
		const packs = (body.packs ?? []).map(
			(p) => `- ${p.name}: $${p.price_usd} for ${p.credits.toLocaleString('en-US')} credits: ${p.checkout_url}`,
		);
		description = [
			body.action?.prompt_to_user,
			packs.length ? `Credit packs (one-time payment):\n${packs.join('\n')}` : undefined,
			"After payment the success page shows your key. Put it in the 'ContextFetch API' credential and run the node again.",
		]
			.filter(Boolean)
			.join('\n\n');
	} else if (status === 401) {
		message = 'ContextFetch did not accept the API key';
		description =
			"Check the API key in the 'ContextFetch API' credential. A free key with 2,500 credits: POST https://api.contextfetch.dev/v1/keys/free (one per network). Or buy credits: " +
			BUY_URL;
	} else if (status === 400 && body.error === 'url_not_allowed') {
		message = 'This URL cannot be fetched';
		description = "Only public http(s) URLs are allowed. Change 'URL' or 'URLs' to a public web address.";
	} else if (status === 422) {
		message = `ContextFetch rejected the parameters: ${validationText(body.detail) || 'invalid request'}`;
		description = 'Change the parameter named above and run the node again.';
	} else if (status === 429) {
		message = 'ContextFetch is rate limiting requests';
		description = "Wait a few seconds, or turn on 'Retry On Fail' in the node settings.";
	} else if (status === 503) {
		message = body.message ?? 'ContextFetch web search is temporarily unavailable';
		description =
			"Try again shortly, or turn on 'Retry On Fail' in the node settings. Paid requests that fail are refunded.";
	} else if (status >= 500) {
		description = "Try again shortly, or turn on 'Retry On Fail' in the node settings. Paid requests that fail are refunded.";
	}

	throw new NodeApiError(this.getNode(), body as JsonObject, {
		message,
		description,
		httpCode: String(status),
		itemIndex: this.getItemIndex(),
	});
}

/** Get Contents: one item per URL. Pages that loaded carry the page; URLs that did not load carry `error`. */
export async function contentsToItems(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const body = response.body as IDataObject;
	const results = (body.results as IDataObject[] | undefined) ?? [];
	const failed = ((body.statuses as IDataObject[] | undefined) ?? [])
		.filter((s) => s.status === 'error')
		.map((s) => ({
			url: s.id,
			error: ((s.error as IDataObject | undefined)?.message as string | undefined) ?? 'Page did not load',
			errorTag: (s.error as IDataObject | undefined)?.tag,
		}));
	return [...results, ...failed].map((json) => ({ json: json as IDataObject }));
}

/** Map: one item per URL. */
export async function urlsToItems(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const urls = ((response.body as IDataObject).results as string[] | undefined) ?? [];
	return urls.map((url) => ({ json: { url } }));
}
