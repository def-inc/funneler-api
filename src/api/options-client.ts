// eslint-disable-next-line import/no-nodejs-modules -- need http/https for proper error handling
import http from "http";
// eslint-disable-next-line import/no-nodejs-modules
import https from "https";
import type {FunnelerApiSettings} from "../settings";
import {getHostUrl} from "../settings";
import type {SelectOption, TenantEmail} from "../types";

const cache = new Map<string, { data: SelectOption[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getJson(url: string, token: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const mod = parsed.protocol === "https:" ? https : http;

		const req = mod.request(
			url,
			{
				method: "GET",
				headers: {
					"Authorization": `Bearer ${token}`,
					"Accept": "application/json",
				},
			},
			(res) => {
				const chunks: Uint8Array[] = [];
				res.on("data", (chunk: Uint8Array) => chunks.push(chunk));
				res.on("end", () => {
					const decoder = new TextDecoder();
					const text = chunks.map(c => decoder.decode(c, {stream: true})).join("") + decoder.decode();
					try {
						resolve(JSON.parse(text) as unknown);
					} catch {
						reject(new Error(`JSONパースエラー: ${text.slice(0, 200)}`));
					}
				});
			},
		);

		req.on("error", (err: Error) => {
			reject(new Error(`ネットワークエラー: ${err.message}`));
		});

		req.end();
	});
}

export async function fetchTenantEmails(
	settings: FunnelerApiSettings,
): Promise<SelectOption[]> {
	const cacheKey = "tenant_emails";
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
		return cached.data;
	}

	const hostUrl = getHostUrl();
	const url = `${hostUrl}/tenant_emails`;
	const json = await getJson(url, settings.apiToken);

	console.debug("[funneler-api] GET /tenant_emails response:", json);

	const items = json as TenantEmail[];
	if (!Array.isArray(items)) {
		throw new Error(`想定外のレスポンス形式: ${JSON.stringify(json).slice(0, 200)}`);
	}
	const options: SelectOption[] = items.map(item => ({
		value: String(item.id),
		label: item.display_name,
	}));

	cache.set(cacheKey, {data: options, timestamp: Date.now()});
	return options;
}
