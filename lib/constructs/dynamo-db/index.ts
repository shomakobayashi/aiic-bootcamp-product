import { RemovalPolicy, CfnOutput, Stack } from 'aws-cdk-lib';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DynamoDBConstructProps {
  removalPolicy?: RemovalPolicy;
}

/**
 * ECサイト用 DynamoDB テーブルの作成
 */
export class DynamoDBConstruct extends Construct {
  public readonly productsTable: Table;
  public readonly cartsTable: Table;
  public readonly ordersTable: Table;
  public readonly usersTable: Table;

  constructor(scope: Construct, id: string, props?: DynamoDBConstructProps) {
    super(scope, id);

    const removalPolicy = props?.removalPolicy || RemovalPolicy.RETAIN;

    // 商品テーブル
    this.productsTable = new Table(this, 'ProductsTable', {
      tableName: 'ec-products',
      partitionKey: {
        name: 'productId',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: true,
    });

    // カートテーブル
    this.cartsTable = new Table(this, 'CartsTable', {
      tableName: 'ec-carts',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'productId',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: true,
    });

    // 注文テーブル
    this.ordersTable = new Table(this, 'OrdersTable', {
      tableName: 'ec-orders',
      partitionKey: {
        name: 'orderId',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: true,
    });

    // GSI for user's orders
    this.ordersTable.addGlobalSecondaryIndex({
      indexName: 'UserOrdersIndex',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: AttributeType.STRING,
      },
    });

    // ユーザーテーブル
    this.usersTable = new Table(this, 'UsersTable', {
      tableName: 'ec-users',
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy,
      pointInTimeRecovery: true,
    });

    // GSI for email lookup
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: {
        name: 'email',
        type: AttributeType.STRING,
      },
    });
  }
}
