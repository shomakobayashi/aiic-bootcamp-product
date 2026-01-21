import { CfnOutput, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as assets from 'aws-cdk-lib/aws-ecr-assets';
import * as path from 'path';

export interface BedrockAgentConstructProps {
  /**
   * エージェント名
   */
  agentName?: string;

  /**
   * ECRリポジトリ名
   */
  repositoryName?: string;

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
}

export class BedrockAgentConstruct extends Construct {
  public readonly repository: ecr.Repository;
  public readonly executionRole: iam.Role;
  public readonly dockerImageAsset: assets.DockerImageAsset;

  constructor(scope: Construct, id: string, props: BedrockAgentConstructProps = {}) {
    super(scope, id);

    const agentName = props.agentName || 'aws-operations-agent';
    const repositoryName = props.repositoryName || 'bedrock-agentcore-agent';
    const region = props.region || 'us-east-1';
    const modelId = props.modelId || 'us.anthropic.claude-sonnet-4-20250514-v1:0';
    const removalPolicy = props.removalPolicy || RemovalPolicy.RETAIN;
    const agentSourcePath = props.agentSourcePath || path.join(__dirname, '../../../agent');

    // ECR リポジトリの作成
    this.repository = new ecr.Repository(this, 'Repository', {
      repositoryName: repositoryName,
      removalPolicy: removalPolicy,
      emptyOnDelete: removalPolicy === RemovalPolicy.DESTROY,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          maxImageCount: 10,
          description: 'Keep only 10 images',
        },
      ],
    });

    // Bedrock AgentCore 実行ロールの作成
    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `BedrockAgentCoreExecutionRole-${Stack.of(this).stackName}`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
        new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      ),
      description: 'Execution role for Bedrock AgentCore runtime',
    });

    // Bedrock モデル呼び出し権限
    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'BedrockInvokeModel',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          `arn:aws:bedrock:${region}::foundation-model/${modelId}`,
          `arn:aws:bedrock:${region}::foundation-model/*`,
        ],
      })
    );

    // Lambda 操作権限（エージェントツール用）
    this.executionRole.addToPolicy(
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
    this.executionRole.addToPolicy(
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

    // ECR 権限
    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ECRPull',
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
          'ecr:BatchCheckLayerAvailability',
        ],
        resources: [this.repository.repositoryArn],
      })
    );

    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ECRAuth',
        effect: iam.Effect.ALLOW,
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // CloudWatch Logs 権限
    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CloudWatchLogs',
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['*'],
      })
    );

    // Docker イメージアセットの作成
    this.dockerImageAsset = new assets.DockerImageAsset(this, 'AgentImage', {
      directory: agentSourcePath,
      platform: assets.Platform.LINUX_ARM64,
    });

    // CloudFormation 出力
    new CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${Stack.of(this).stackName}-AgentRepositoryUri`,
    });

    new CfnOutput(this, 'RepositoryArn', {
      value: this.repository.repositoryArn,
      description: 'ECR Repository ARN',
      exportName: `${Stack.of(this).stackName}-AgentRepositoryArn`,
    });

    new CfnOutput(this, 'ExecutionRoleArn', {
      value: this.executionRole.roleArn,
      description: 'Bedrock Agent Execution Role ARN',
      exportName: `${Stack.of(this).stackName}-AgentExecutionRoleArn`,
    });

    new CfnOutput(this, 'DockerImageUri', {
      value: this.dockerImageAsset.imageUri,
      description: 'Docker Image URI',
      exportName: `${Stack.of(this).stackName}-AgentDockerImageUri`,
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
    this.executionRole.addToPolicy(
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
    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction'],
        resources: [functionArn],
      })
    );
  }
}
