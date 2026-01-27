# BroadcastMail API

## 認証

全てのリクエストに `Authorization` ヘッダーで Bearer トークンが必要。

```
Authorization: Bearer <api_token>
```

トークンはダッシュボードの設定画面（設定 > APIトークン）から生成する。

## エンドポイント

### POST /dashboard/api/broadcast_mails

BroadcastMail を下書きとして作成する。

**Content-Type:** `multipart/form-data`

#### パラメータ

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| `subject` | string | Yes | メール件名 |
| `content` | string | Yes | Markdown テキスト（標準 markdown + Obsidian `![[file]]` 記法対応） |
| `images[]` | file | No | content 内で参照する画像ファイル（複数可） |
| `tenant_email_id` | integer | No | 送信元メール ID。未指定時はテナントのデフォルトメール |
| `tag_ids[]` | integer | No | 配信対象のタグ ID |
| `scheduled_at` | datetime | No | 配信日時（ISO 8601 形式）。未指定時は1年後 |

#### 画像のマッチング

Markdown 内の画像ファイル名とアップロードするファイル名を一致させる必要がある。

```markdown
![[photo.png]]       --> "photo.png" という名前のファイルをアップロード
![alt](diagram.jpg)  --> "diagram.jpg" という名前のファイルをアップロード
```

対応する Obsidian 記法:
- `![[image.png]]`
- `![[image.png|100x200]]`（サイズ指定は無視される）
- `![[image.png|代替テキスト]]`

#### レスポンス

**201 Created**
```json
{
  "id": 123,
  "status": "draft"
}
```

**401 Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**422 Unprocessable Entity**
```json
{
  "errors": ["Subjectを入力してください"]
}
```

#### 例

```bash
curl -X POST https://dashboard.example.com/dashboard/api/broadcast_mails \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "subject=ニュースレターのタイトル" \
  -F "content=# 見出し

テキスト ![[photo.png]]

続きの内容" \
  -F "images[]=@/path/to/photo.png"
```
