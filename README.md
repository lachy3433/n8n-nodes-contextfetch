# n8n-nodes-contextfetch

This is an n8n community node. It lets you use [ContextFetch](https://contextfetch.dev) in your n8n workflows.

ContextFetch is a web search and page-to-Markdown API for AI agents. It returns search results with the page text as Markdown, plus highlights and a pruned context: only the chunks of each page that match your query.

[n8n](https://n8n.io/) is a fair-code licensed workflow automation platform.

[Installation](#installation) ·
[Operations](#operations) ·
[Credentials](#credentials) ·
[Use it as an AI Agent tool](#use-it-as-an-ai-agent-tool) ·
[Usage examples](#usage-examples) ·
[Errors](#errors) ·
[Compatibility](#compatibility) ·
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. In short: **Settings > Community Nodes > Install**, then enter `n8n-nodes-contextfetch`.

Only Owner and Admin users can install community nodes. This package is not verified by n8n yet, and unverified community nodes are not available on n8n Cloud, so use self-hosted n8n.

## Operations

Each operation is one call to the ContextFetch API. Credits are charged by the API, not by n8n.

- **Search**: search the web. Choose what page content each result carries: Full Text (Markdown), Highlights, Pruned Context. Options: include or exclude domains, published after a date. Outputs one item per result. 1 credit per call.
- **Get Contents**: fetch up to 10 URLs as Markdown, optionally with highlights and a pruned context for a query. Outputs one item per URL; a URL that did not load comes back as an item with `url` and `error`. 1 credit per page that loads.
- **Answer**: search, then quote up to 3 of the most relevant passages from the top pages, each followed by `[n]`, with `citations`. Extractive: no text is generated, and `answer` is empty when nothing relevant is found. Outputs one item. 1 credit.
- **Research**: run up to 5 searches at once (yours, or derived from the question), rank all pages together and return `evidence`, one Markdown document of quoted passages with numbered sources, plus `results`. No LLM runs. Outputs one item. 1 credit per search.
- **Crawl**: follow same-site links from a start URL (up to 3 hops) and get every page as Markdown, optionally ranked and pruned to a query. robots.txt is obeyed. Outputs one item per page. 1 credit per page returned.
- **Map**: list a site's URLs from its links and sitemaps without fetching the pages. Outputs one item per URL. 1 credit.

## Credentials

You need a ContextFetch API key.

1. Get a free key with 2,500 credits (one per network, no signup):

   ```bash
   curl -X POST https://api.contextfetch.dev/v1/keys/free
   ```

   Or buy credits at <https://contextfetch.dev/#buy>; the key is shown after payment.
2. In n8n, create a **ContextFetch API** credential and paste the key into **API Key**.
3. Leave **Base URL** at `https://api.contextfetch.dev` unless you use another ContextFetch host.

The credential test calls `GET /v1/balance`, which costs no credits. The key is sent as `Authorization: Bearer <key>`.

## Use it as an AI Agent tool

The node is usable as a tool (`usableAsTool`). Add **ContextFetch Tool** to an AI Agent's tools, pick an operation, and let the model fill the inputs with **Let the model define this parameter** (a `$fromAI()` expression). For example, for Search:

```
Query: {{ $fromAI('query', 'A short web search query', 'string') }}
Max Results: 5
Page Content: Pruned Context
```

Pruned Context keeps the tool output small: the model gets the chunks of each page that match the query instead of whole pages. When a tool call fails, the agent receives the error message; for HTTP 402 that message includes the payment link, so the agent can pass it to you.

## Usage examples

**Search, then process each result.** Search outputs one item per result with `url`, `title`, `score`, and the content you chose (`text`, `highlights`, `prunedContext`). Connect any node after it; it runs once per result.

**Read a list of pages.** Put the URLs in **Get Contents > URLs**, separated by commas or new lines, or map them from a previous node: `{{ $json.url }}`. Each output item has `text` (Markdown).

**Daily digest without an LLM.** Schedule Trigger > ContextFetch **Research** > Convert to File (`evidence` field, `.md`). The `evidence` field is already a Markdown document with numbered sources.

**Site inventory.** ContextFetch **Map** with **Include Paths** set to `/docs/`, then **Crawl** or **Get Contents** on the URLs you keep.

## Errors

HTTP errors become node errors with a message and a next step:

- **402**: out of credits. The message includes the payment link (from the API's `action.url` or `X-Payment-URL`), and the description lists the credit packs. After payment the success page shows the key; put it in the credential.
- **401**: the key was not accepted. Check the credential, or get a free key.
- **400 `url_not_allowed`**: only public http(s) URLs can be fetched.
- **422**: the API rejected a parameter; the message names it.
- **429, 5xx**: try again shortly, or turn on **Retry On Fail** in the node settings. The API refunds paid requests that fail.

Turn on **Settings > On Error > Continue** to keep a workflow running and get the error as an item instead.

## Compatibility

Tested with n8n 2.43.7 (Docker image `docker.n8n.io/n8nio/n8n:2.43.7`), installed from the packed npm tarball into `~/.n8n/nodes`, running all six operations against the live API and as two AI Agent tools. The 402 path was checked against a local server returning the API's 402 body.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [ContextFetch API reference](https://contextfetch.dev/docs/reference)
- [ContextFetch API reference as plain text](https://contextfetch.dev/llms-full.txt)

## Version history

- 0.1.0: first release. Search, Get Contents, Answer, Research, Crawl and Map; usable as an AI Agent tool.
