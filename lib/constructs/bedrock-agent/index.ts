import { CfnOutput, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';
import * as path from 'path';

export interface BedrockAgentConstructProps {
  /**
   * エージェント名
   */
  agentName?: string;

  /**
   * AWSリージョン
   * @default us-east-1
   */
  region?: string;

  /**
   * Bedrock モデルID
   * @default us.anthropic.claude-sonnet-4-20250514-v1:0
   */
  modelId?: string;

  /**
   * 削除ポリシー
   * @default RemovalPolicy.RETAIN
   */
  removalPolicy?: RemovalPolicy;

  /**
   * エージェントのソースディレクトリパス
   */
  agentSourcePath?: string;

  /**
   * 環境変数
   */
  environmentVariables?: { [key: string]: string };
}

export class BedrockAgentConstruct extends Construct {
  public readonly runtime: agentcore.Runtime;
  public readonly executionRole: iam.IRole;

  constructor(scope: Construct, id: string, props: BedrockAgentConstructProps = {}) {
    super(scope, id);

    const agentName = props.agentName || 'aws-operations-agent';
    const region = props.region || 'us-east-1';
    const modelId = props.modelId || 'us.anthropic.claude-sonnet-4-20250514-v1:0';
    const agentSourcePath = props.agentSourcePath || path.join(__dirname, '../../../agent');

    // エージェントソースからDockerイメージをビルドするArtifactを作成
    const artifact = agentcore.AgentRuntimeArtifact.fromAsset(agentSourcePath);

    // 環境変数のマージ
    const environmentVariables = {
      AWS_REGION: region,
      AWS_DEFAULT_REGION: region,
      ...props.environmentVariables,
    };

    // Runtime を作成
    this.runtime = new agentcore.Runtime(this, 'Runtime', {
      runtimeName: agentName,
      agentRuntimeArtifact: artifact,
      description: 'AWS Lambda、DynamoDB、API Gatewayを操作するエージェント',
      environmentVariables: environmentVariables,
    });

    // 実行ロールを取得
    this.executionRole = this.runtime.role;

    // Bedrock モデル呼び出し権限を追加
    const accountId = Stack.of(this).account;
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockModelInvocation',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:ApplyGuardrail',
        ],
        resources: [
          // 全リージョンのFoundation Model
          'arn:aws:bedrock:*::foundation-model/*',
          // 全リージョンのInference Profile
          'arn:aws:bedrock:*:*:inference-profile/*',
          // アカウント固有のBedrockリソース
          `arn:aws:bedrock:${region}:${accountId}:*`,
        ],
      })
    );

    // Lambda 操作権限（エージェントツール用）
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'LambdaOperations',
        effect: iam.Effect.ALLOW,
        actions: [
          'lambda:InvokeFunction',
          'lambda:GetFunction',
          'lambda:ListFunctions',
        ],
        resources: ['*'],
      })
    );

    // DynamoDB 操作権限（エージェントツール用）
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'DynamoDBOperations',
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: ['*'],
      })
    );

    // CloudFormation 出力
    new CfnOutput(this, 'RuntimeArn', {
      value: this.runtime.agentRuntimeArn,
      description: 'Bedrock AgentCore Runtime ARN',
      exportName: `${Stack.of(this).stackName}-AgentRuntimeArn`,
    });

    new CfnOutput(this, 'RuntimeId', {
      value: this.runtime.agentRuntimeId,
      description: 'Bedrock AgentCore Runtime ID',
      exportName: `${Stack.of(this).stackName}-AgentRuntimeId`,
    });

    new CfnOutput(this, 'AgentName', {
      value: agentName,
      description: 'Bedrock Agent Name',
      exportName: `${Stack.of(this).stackName}-AgentName`,
    });
  }

  /**
   * 特定のDynamoDBテーブルへのアクセス権限を付与
   */
  public grantDynamoDBAccess(tableArn: string): void {
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
          'dynamodb:Query',
          'dynamodb:Scan',
        ],
        resources: [tableArn, `${tableArn}/index/*`],
      })
    );
  }

  /**
   * 特定のLambda関数への呼び出し権限を付与
   */
  public grantLambdaInvoke(functionArn: string): void {
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [functionArn],
      })
    );
  }
}
