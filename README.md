# AIIC Bootcamp Product - ECサイトAPI

API Gateway、Lambda (TypeScript + Hono)、DynamoDB を AWS CDK (TypeScript) で実装したECサイト用APIです。

## アーキテクチャ

- **API Gateway**: REST API のエントリーポイント
- **Lambda**: Hono フレームワークを使用した TypeScript API
- **DynamoDB**: NoSQL データベース（複数テーブル設計）
  - Products: 商品管理
  - Carts: カート管理
  - Orders: 注文管理
  - Users: ユーザー管理

## セットアップ

### 前提条件
- Node.js 20.x 以上
- pnpm 9.x 以上 (`npm install -g pnpm` でインストール)
- AWS CLI 設定済み

### 手順

1. CDKプロジェクトの依存関係をインストール:
```bash
pnpm install
```

2. Lambda関数の依存関係をインストール:
```bash
cd lambda/api
pnpm install
cd ../..
```

3. CDKスタックをビルド:
```bash
pnpm run build
```

4. CloudFormationテンプレートを確認:
```bash
pnpm cdk synth
```

## デプロイ

AWSにデプロイする前に、AWS認証情報を設定してください。

```bash
# 初回デプロイ時（CDK Bootstrapが必要な場合）
pnpm cdk bootstrap

# スタックをデプロイ
pnpm cdk deploy
```

デプロイ後、API GatewayのURLがターミナルに出力されます。

## API エンドポイント

### ヘルスチェック
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/` | ヘルスチェック |

### 商品管理 (Products)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/products` | 全商品取得 |
| GET | `/products/:productId` | 商品詳細取得 |
| POST | `/products` | 商品作成 |
| PUT | `/products/:productId` | 商品更新 |
| DELETE | `/products/:productId` | 商品削除 |

### カート管理 (Cart)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/carts/:userId` | ユーザーのカート取得 |
| POST | `/carts/:userId/items` | カートに商品追加 |
| PUT | `/carts/:userId/items/:productId` | カート内商品の数量更新 |
| DELETE | `/carts/:userId/items/:productId` | カートから商品削除 |
| DELETE | `/carts/:userId` | カートをクリア |

### 注文管理 (Orders)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/orders/user/:userId` | ユーザーの注文履歴取得 |
| GET | `/orders/:orderId` | 注文詳細取得 |
| POST | `/orders` | 注文作成 |
| PUT | `/orders/:orderId/status` | 注文ステータス更新 |

### ユーザー管理 (Users)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/users` | 全ユーザー取得 |
| GET | `/users/:userId` | ユーザー詳細取得 |
| GET | `/users/email/:email` | メールアドレスでユーザー検索 |
| POST | `/users` | ユーザー作成 |
| PUT | `/users/:userId` | ユーザー情報更新 |
| DELETE | `/users/:userId` | ユーザー削除 |

## 使用例

API_URL変数にデプロイ後のAPI Gateway URLを設定してください。

```bash
# 環境変数設定
export API_URL="https://<api-id>.execute-api.<region>.amazonaws.com/v1"

# ========================================
# ヘルスチェック
# ========================================
curl $API_URL/

# ========================================
# 商品管理
# ========================================

# 商品作成
curl -X POST $API_URL/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ノートパソコン",
    "description": "高性能なノートパソコン",
    "price": 120000,
    "stock": 10,
    "category": "electronics",
    "imageUrl": "https://example.com/laptop.jpg"
  }'

# 全商品取得
curl $API_URL/products

# 商品詳細取得
curl $API_URL/products/<product-id>

# 商品更新
curl -X PUT $API_URL/products/<product-id> \
  -H "Content-Type: application/json" \
  -d '{
    "price": 110000,
    "stock": 8
  }'

# 商品削除
curl -X DELETE $API_URL/products/<product-id>

# ========================================
# ユーザー管理
# ========================================

# ユーザー作成
curl -X POST $API_URL/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "山田太郎",
    "address": {
      "zipCode": "123-4567",
      "prefecture": "東京都",
      "city": "渋谷区",
      "street": "道玄坂1-2-3"
    }
  }'

# 全ユーザー取得
curl $API_URL/users

# ユーザー詳細取得
curl $API_URL/users/<user-id>

# メールアドレスでユーザー検索
curl $API_URL/users/email/user@example.com

# ========================================
# カート管理
# ========================================

# カートに商品追加
curl -X POST $API_URL/carts/<user-id>/items \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "<product-id>",
    "quantity": 2
  }'

# カート取得
curl $API_URL/carts/<user-id>

# カート内商品の数量更新
curl -X PUT $API_URL/carts/<user-id>/items/<product-id> \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 3
  }'

# カートから商品削除
curl -X DELETE $API_URL/carts/<user-id>/items/<product-id>

# カートをクリア
curl -X DELETE $API_URL/carts/<user-id>

# ========================================
# 注文管理
# ========================================

# 注文作成
curl -X POST $API_URL/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<user-id>",
    "items": [
      {
        "productId": "<product-id>",
        "quantity": 2,
        "price": 120000
      }
    ],
    "totalAmount": 240000,
    "shippingAddress": {
      "zipCode": "123-4567",
      "prefecture": "東京都",
      "city": "渋谷区",
      "street": "道玄坂1-2-3"
    }
  }'

# ユーザーの注文履歴取得
curl $API_URL/orders/user/<user-id>

# 注文詳細取得
curl $API_URL/orders/<order-id>

# 注文ステータス更新
curl -X PUT $API_URL/orders/<order-id>/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "shipped"
  }'
```

## データモデル

### Product (商品)
```json
{
  "productId": "uuid",
  "name": "string",
  "description": "string",
  "price": "number",
  "stock": "number",
  "category": "string",
  "imageUrl": "string",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### CartItem (カートアイテム)
```json
{
  "userId": "string",
  "productId": "string",
  "quantity": "number",
  "addedAt": "ISO8601"
}
```

### Order (注文)
```json
{
  "orderId": "uuid",
  "userId": "string",
  "items": [
    {
      "productId": "string",
      "quantity": "number",
      "price": "number"
    }
  ],
  "totalAmount": "number",
  "status": "pending | processing | shipped | delivered | cancelled",
  "shippingAddress": {
    "zipCode": "string",
    "prefecture": "string",
    "city": "string",
    "street": "string"
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### User (ユーザー)
```json
{
  "userId": "uuid",
  "email": "string",
  "name": "string",
  "address": {
    "zipCode": "string",
    "prefecture": "string",
    "city": "string",
    "street": "string"
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

## CDKコマンド

* `pnpm run build`   TypeScriptをJSにコンパイル
* `pnpm run watch`   変更を監視してコンパイル
* `pnpm run test`    Jestユニットテストを実行
* `pnpm cdk deploy`  スタックをAWSアカウント/リージョンにデプロイ
* `pnpm cdk diff`    デプロイ済みスタックと現在の状態を比較
* `pnpm cdk synth`   CloudFormationテンプレートを生成
* `pnpm cdk destroy` スタックを削除

## プロジェクト構造

```
.
├── bin/
│   └── aiic-bootcamp-product.ts           # CDKアプリのエントリーポイント
├── lib/
│   ├── aiic-bootcamp-product-stack.ts     # メインCDKスタック
│   └── constructs/                        # 再利用可能なConstructs
│       ├── dynamo-db/
│       │   └── index.ts                   # DynamoDB Construct (4テーブル)
│       ├── lambda/
│       │   └── index.ts                   # Lambda Construct
│       └── api-gateway/
│           └── index.ts                   # API Gateway Construct
├── lambda/
│   └── api/
│       ├── index.ts                       # Lambda関数（Hono ECサイトAPI）
│       ├── package.json
│       └── tsconfig.json
├── test/
├── cdk.json
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── README.md
```

## DynamoDBテーブル設計

### ec-products (商品テーブル)
- **Partition Key**: productId (String)
- 商品情報を格納

### ec-carts (カートテーブル)
- **Partition Key**: userId (String)
- **Sort Key**: productId (String)
- ユーザーごとのカート情報を格納

### ec-orders (注文テーブル)
- **Partition Key**: orderId (String)
- **GSI**: UserOrdersIndex
  - Partition Key: userId (String)
  - Sort Key: createdAt (String)
- 注文情報を格納、ユーザーごとの注文履歴検索用GSI

### ec-users (ユーザーテーブル)
- **Partition Key**: userId (String)
- **GSI**: EmailIndex
  - Partition Key: email (String)
- ユーザー情報を格納、メールアドレス検索用GSI

## セキュリティとベストプラクティス

本番環境にデプロイする際は以下を検討してください:

1. **認証・認可**: Amazon Cognito や API Gatewayのオーソライザーを追加
2. **バリデーション**: リクエストボディの入力検証を強化
3. **レート制限**: API Gatewayのスロットリング設定
4. **エラーハンドリング**: より詳細なエラーメッセージとログ記録
5. **CORS設定**: 許可するオリジンを制限
6. **DynamoDB**: RemovalPolicyをRETAINに設定
7. **環境変数**: 機密情報はAWS Secrets Managerを使用
8. **モニタリング**: CloudWatch Logs、X-Rayの有効化
