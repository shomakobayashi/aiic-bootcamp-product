import { Duration, CfnOutput, Stack } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import { Construct } from 'constructs';

export interface LambdaConstructProps {
  productsTable: Table;
  cartsTable: Table;
  ordersTable: Table;
  usersTable: Table;
  functionName?: string;
  timeout?: Duration;
  memorySize?: number;
}

export class LambdaConstruct extends Construct {
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaConstructProps) {
    super(scope, id);

    this.function = new NodejsFunction(this, 'Function', {
      functionName: props.functionName,
      entry: path.join(__dirname, '../../../lambda/api/index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      environment: {
        PRODUCTS_TABLE_NAME: props.productsTable.tableName,
        CARTS_TABLE_NAME: props.cartsTable.tableName,
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      timeout: props.timeout || Duration.seconds(30),
      memorySize: props.memorySize || 128,
      bundling: {
        minify: false,
        sourceMap: true,
        format: OutputFormat.ESM,
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
        nodeModules: ['hono'],
        externalModules: [
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/lib-dynamodb',
        ],
      },
    });

    // DynamoDB へのアクセス権限を付与
    props.productsTable.grantReadWriteData(this.function);
    props.cartsTable.grantReadWriteData(this.function);
    props.ordersTable.grantReadWriteData(this.function);
    props.usersTable.grantReadWriteData(this.function);

    // CloudFormation出力
    new CfnOutput(this, 'FunctionName', {
      value: this.function.functionName,
      description: 'Lambda Function Name',
      exportName: `${Stack.of(this).stackName}-FunctionName`,
    });

    new CfnOutput(this, 'FunctionArn', {
      value: this.function.functionArn,
      description: 'Lambda Function ARN',
      exportName: `${Stack.of(this).stackName}-FunctionArn`,
    });
  }
}
