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

    const agentName = props.agentName || 'aws_operations_agent';
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

    const accountId = Stack.of(this).account;
    const ecrRepoName = `bedrock-agentcore-${agentName}`;

    // ECR イメージアクセス権限
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ECRImageAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:BatchGetImage',
          'ecr:GetDownloadUrlForLayer',
        ],
        resources: [
          `arn:aws:ecr:${region}:${accountId}:repository/${ecrRepoName}`,
        ],
      })
    );

    // ECR トークンアクセス権限
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ECRTokenAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetAuthorizationToken',
        ],
        resources: ['*'],
      })
    );

    // CloudWatch Logs 権限 (DescribeLogStreams, CreateLogGroup)
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:DescribeLogStreams',
          'logs:CreateLogGroup',
        ],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*`,
        ],
      })
    );

    // CloudWatch Logs 権限 (DescribeLogGroups)
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:DescribeLogGroups',
        ],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:*`,
        ],
      })
    );

    // CloudWatch Logs 権限 (CreateLogStream, PutLogEvents)
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: [
          `arn:aws:logs:${region}:${accountId}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*`,
        ],
      })
    );

    // CloudWatch Logs 権限 (広範囲)
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:PutDeliverySource',
          'logs:PutDeliveryDestination',
          'logs:CreateDelivery',
          'logs:GetDeliverySource',
          'logs:DeleteDeliverySource',
          'logs:DeleteDeliveryDestination',
        ],
        resources: ['*'],
      })
    );

    // X-Ray 権限
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
        ],
        resources: ['*'],
      })
    );

    // CloudWatch Metrics 権限 (条件付き)
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cloudwatch:PutMetricData',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'bedrock-agentcore',
          },
        },
      })
    );

    // Bedrock Agent Core Identity - GetResourceApiKey
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockAgentCoreIdentityGetResourceApiKey',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:GetResourceApiKey',
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:token-vault/default`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:token-vault/default/apikeycredentialprovider/*`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default/workload-identity/*`,
        ],
      })
    );

    // Secrets Manager 権限 (Credential Provider Client Secret)
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockAgentCoreIdentityGetCredentialProviderClientSecret',
        effect: iam.Effect.ALLOW,
        actions: [
          'secretsmanager:GetSecretValue',
        ],
        resources: [
          `arn:aws:secretsmanager:${region}:${accountId}:secret:bedrock-agentcore-identity!default/oauth2/*`,
          `arn:aws:secretsmanager:${region}:${accountId}:secret:bedrock-agentcore-identity!default/apikey/*`,
        ],
      })
    );

    // Bedrock Agent Core Identity - GetResourceOauth2Token
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockAgentCoreIdentityGetResourceOauth2Token',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:GetResourceOauth2Token',
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:token-vault/default`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:token-vault/default/oauth2credentialprovider/*`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default/workload-identity/${agentName}-*`,
        ],
      })
    );

    // Bedrock モデル呼び出し権限
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
          'arn:aws:bedrock:*::foundation-model/*',
          'arn:aws:bedrock:*:*:inference-profile/*',
          `arn:aws:bedrock:${region}:${accountId}:*`,
        ],
      })
    );

    // Marketplace 権限 (条件付き)
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'MarketplaceSubscribeOnFirstCall',
        effect: iam.Effect.ALLOW,
        actions: [
          'aws-marketplace:ViewSubscriptions',
          'aws-marketplace:Subscribe',
        ],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'aws:CalledViaLast': 'bedrock.amazonaws.com',
          },
        },
      })
    );

    // Bedrock Agent Core Code Interpreter
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockAgentCoreCodeInterpreter',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:StartCodeInterpreterSession',
          'bedrock-agentcore:InvokeCodeInterpreter',
          'bedrock-agentcore:StopCodeInterpreterSession',
          'bedrock-agentcore:GetCodeInterpreter',
          'bedrock-agentcore:GetCodeInterpreterSession',
          'bedrock-agentcore:ListCodeInterpreterSessions',
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:aws:code-interpreter/aws.codeinterpreter.v1`,
        ],
      })
    );

    // Bedrock Agent Core Identity
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockAgentCoreIdentity',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock-agentcore:CreateWorkloadIdentity',
          'bedrock-agentcore:GetWorkloadAccessTokenForUserId',
        ],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default`,
          `arn:aws:bedrock-agentcore:${region}:${accountId}:workload-identity-directory/default/workload-identity/*`,
        ],
      })
    );

    // STS Web Identity Token
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'AwsJwtFederation',
        effect: iam.Effect.ALLOW,
        actions: [
          'sts:GetWebIdentityToken',
        ],
        resources: ['*'],
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
          'dynamodb:ListTables',
        ],
        resources: ['*'],
      })
    );

    // API Gateway 読み取り権限（apigateway_tool用）
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'ApiGatewayReadAccess',
        effect: iam.Effect.ALLOW,
        actions: ['*'],
        resources: ['*'],
      })
    );

    // CloudWatch Logs 読み取り権限（cloudwatch_tool用）
    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogsReadAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:Describe*',
          'logs:Get*',
          'logs:FilterLogEvents',
          'logs:StartQuery',
          'logs:StopQuery',
          'logs:TestMetricFilter',
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
