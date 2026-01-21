import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DynamoDBConstruct } from './constructs/dynamo-db';
import { LambdaConstruct } from './constructs/lambda';
import { ApiGatewayConstruct } from './constructs/api-gateway';
import { BedrockAgentConstruct } from './constructs/bedrock-agent';

export class AiicBootcampProductStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /**
     * DynamoDB テーブルの作成（ECサイト用）
     */
    const dynamoDB = new DynamoDBConstruct(this, 'DynamoDB', {
      removalPolicy: RemovalPolicy.DESTROY, // 開発用設定（本番では変更してください）
    });

    /**
     * Lambda 関数の作成
     */
    const lambdaFunction = new LambdaConstruct(this, 'Lambda', {
      productsTable: dynamoDB.productsTable,
      cartsTable: dynamoDB.cartsTable,
      ordersTable: dynamoDB.ordersTable,
      usersTable: dynamoDB.usersTable,
      reviewsTable: dynamoDB.reviewsTable,
      functionName: 'aiic-bootcamp-ec-api-handler',
      timeout: Duration.seconds(30),
      memorySize: 256,
    });

    /**
     * API Gateway の作成
     */
    new ApiGatewayConstruct(this, 'ApiGateway', {
      lambdaFunction: lambdaFunction.function,
      apiName: 'AIIC Bootcamp EC API',
      stageName: 'v1',
      enableCors: true,
    });

    /**
     * Bedrock Agent の作成
     */
    const bedrockAgent = new BedrockAgentConstruct(this, 'BedrockAgent', {
      agentName: 'aws_operations_agent',
      region: 'ap-northeast-1',
      removalPolicy: RemovalPolicy.DESTROY, // 開発用設定（本番では変更してください）
    });

    // エージェントに特定リソースへのアクセス権限を付与（全テーブル）
    bedrockAgent.grantDynamoDBAccess(dynamoDB.productsTable.tableArn);
    bedrockAgent.grantDynamoDBAccess(dynamoDB.cartsTable.tableArn);
    bedrockAgent.grantDynamoDBAccess(dynamoDB.ordersTable.tableArn);
    bedrockAgent.grantDynamoDBAccess(dynamoDB.usersTable.tableArn);
    bedrockAgent.grantDynamoDBAccess(dynamoDB.reviewsTable.tableArn);
    bedrockAgent.grantLambdaInvoke(lambdaFunction.function.functionArn);
  }
}
