// eslint-disable-next-line import/no-nodejs-modules -- requestUrl discards response body on non-2xx; need http for error handling
import http from "http";
// eslint-disable-next-line import/no-nodejs-modules
import https from "https";
import type {FunnelerApiSettings} from "../settings";
import {getHostUrl} from "../settings";
import type {BroadcastFrontmatter, BroadcastMailErrorResponse, BroadcastMailResponse, ResolvedImage} from "../types";

export interface SendMailParams {
	content: string;
	images: ResolvedImage[];
	settings: FunnelerApiSettings;
	frontmatter: BroadcastFrontmatter;
}

function buildMultipartBody(
	fields: Record<string, string>,
	arrayFields: { name: string; value: string }[],
	files: { name: string; filename: string; data: ArrayBuffer }[],
): { boundary: string; body: Uint8Array } {
	const boundary = `----FormBoundary${Date.now().toString(36)}`;
	const encoder = new TextEncoder();
	const parts: Uint8Array[] = [];

	for (const [key, value] of Object.entries(fields)) {
		parts.push(encoder.encode(
			`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
		));
	}

	for (const field of arrayFields) {
		parts.push(encoder.encode(
			`--${boundary}\r\nContent-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
		));
	}

	for (const file of files) {
		parts.push(encoder.encode(
			`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
		));
		parts.push(new Uint8Array(file.data));
		parts.push(encoder.encode("\r\n"));
	}

	parts.push(encoder.encode(`--${boundary}--\r\n`));

	let totalLength = 0;
	for (const part of parts) {
		totalLength += part.byteLength;
	}
	const combined = new Uint8Array(totalLength);
	let offset = 0;
	for (const part of parts) {
		combined.set(part, offset);
		offset += part.byteLength;
	}

	return {boundary, body: combined};
}

function sendMultipart(
	method: "POST" | "PATCH",
	url: string,
	token: string,
	boundary: string,
	body: Uint8Array,
): Promise<{ status: number; json: unknown }> {
	return new Promise((resolve, reject) => {
		const parsed = new URL(url);
		const mod = parsed.protocol === "https:" ? https : http;

		const req = mod.request(
			url,
			{
				method,
				headers: {
					"Authorization": `Bearer ${token}`,
					"Content-Type": `multipart/form-data; boundary=${boundary}`,
					"Content-Length": body.byteLength,
				},
			},
			(res) => {
				const chunks: Uint8Array[] = [];
				res.on("data", (chunk: Uint8Array) => chunks.push(chunk));
				res.on("end", () => {
					const decoder = new TextDecoder();
					const text = chunks.map(c => decoder.decode(c, {stream: true})).join("") + decoder.decode();
					let json: unknown;
					try {
						json = JSON.parse(text) as unknown;
					} catch {
						json = null;
					}
					resolve({status: res.statusCode ?? 0, json});
				});
			},
		);

		req.on("error", (err: Error) => {
			reject(new Error(`ネットワークエラー: ${err.message}`));
		});

		req.write(body);
		req.end();
	});
}

export async function sendBroadcastMail(
	params: SendMailParams,
): Promise<BroadcastMailResponse> {
	const {content, images, settings, frontmatter} = params;
	const hostUrl = getHostUrl();
	const url = `${hostUrl}/broadcast_mails`;

	const fields: Record<string, string> = {
		subject: frontmatter.subject as string,
		content,
	};

	if (frontmatter.tenant_email_id != null) {
		fields["tenant_email_id"] = String(frontmatter.tenant_email_id);
	}
	if (frontmatter.scheduled_at) {
		fields["scheduled_at"] = frontmatter.scheduled_at;
	}

	const arrayFields: { name: string; value: string }[] = [];
	if (frontmatter.tag_ids && frontmatter.tag_ids.length > 0) {
		for (const id of frontmatter.tag_ids) {
			arrayFields.push({name: "tag_ids[]", value: String(id)});
		}
	}

	const files = images.map((image) => ({
		name: "images[]",
		filename: image.filename,
		data: image.data,
	}));

	const {boundary, body} = buildMultipartBody(fields, arrayFields, files);

	const {status, json} = await sendMultipart("POST", url, settings.apiToken, boundary, body);

	return handleResponse(status, json);
}

export async function updateBroadcastMail(
	id: number,
	params: SendMailParams,
): Promise<BroadcastMailResponse> {
	const {content, images, settings, frontmatter} = params;
	const hostUrl = getHostUrl();
	const url = `${hostUrl}/broadcast_mails/${id}`;

	const fields: Record<string, string> = {
		subject: frontmatter.subject as string,
		content,
	};

	if (frontmatter.tenant_email_id != null) {
		fields["tenant_email_id"] = String(frontmatter.tenant_email_id);
	}
	if (frontmatter.scheduled_at) {
		fields["scheduled_at"] = frontmatter.scheduled_at;
	}

	const arrayFields: { name: string; value: string }[] = [];
	if (frontmatter.tag_ids && frontmatter.tag_ids.length > 0) {
		for (const id of frontmatter.tag_ids) {
			arrayFields.push({name: "tag_ids[]", value: String(id)});
		}
	}

	const files = images.map((image) => ({
		name: "images[]",
		filename: image.filename,
		data: image.data,
	}));

	const {boundary, body} = buildMultipartBody(fields, arrayFields, files);

	const {status, json} = await sendMultipart("PATCH", url, settings.apiToken, boundary, body);

	return handleResponse(status, json);
}

function handleResponse(status: number, json: unknown): BroadcastMailResponse {
	if (status === 200 || status === 201) {
		return json as BroadcastMailResponse;
	}

	if (status === 401) {
		throw new Error("認証エラー: APIトークンが無効です。設定を確認してください。");
	}

	if (status === 422) {
		const errorBody = json as BroadcastMailErrorResponse;
		if (errorBody.errors?.length) {
			throw new Error(errorBody.errors.join("\n"));
		}
	}

	throw new Error(`予期しないエラー (HTTP ${status})`);
}
