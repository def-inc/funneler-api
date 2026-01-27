import {requestUrl} from "obsidian";
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
): { boundary: string; body: ArrayBuffer } {
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

	return {boundary, body: combined.buffer};
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

	const response = await requestUrl({
		url,
		method: "POST",
		headers: {
			"Authorization": `Bearer ${settings.apiToken}`,
			"Content-Type": `multipart/form-data; boundary=${boundary}`,
		},
		body,
	});

	if (response.status === 201) {
		return response.json as BroadcastMailResponse;
	} else if (response.status === 401) {
		throw new Error("認証エラー: APIトークンが無効です。設定を確認してください。");
	} else if (response.status === 422) {
		const errorBody = response.json as BroadcastMailErrorResponse;
		throw new Error(errorBody.errors.join("\n"));
	} else {
		throw new Error(`予期しないエラー (HTTP ${response.status})`);
	}
}
