import { CfnOutput, Stack, RemovalPolicy, CustomResource, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
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

  /**
   * CodeBuildでビルドを自動実行するか
   * @default true
   */
  autoBuild?: boolean;
}

export class BedrockAgentConstruct extends Construct {
  public readonly repository: ecr.Repository;
  public readonly executionRole: iam.Role;
  public readonly codeBuildProject: codebuild.Project;
  public readonly sourceAsset: s3assets.Asset;

  constructor(scope: Construct, id: string, props: BedrockAgentConstructProps = {}) {
    super(scope, id);

    const agentName = props.agentName || 'aws-operations-agent';
    const repositoryName = props.repositoryName || 'bedrock-agentcore-agent';
    const region = props.region || 'us-east-1';
    const modelId = props.modelId || 'us.anthropic.claude-sonnet-4-20250514-v1:0';
    const removalPolicy = props.removalPolicy || RemovalPolicy.RETAIN;
    const agentSourcePath = props.agentSourcePath || path.join(__dirname, '../../../agent');
    const autoBuild = props.autoBuild !== false;

    const account = Stack.of(this).account;

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

    // エージェントソースをS3にアップロード
    this.sourceAsset = new s3assets.Asset(this, 'AgentSourceAsset', {
      path: agentSourcePath,
    });

    // CodeBuild プロジェクトの作成
    this.codeBuildProject = new codebuild.Project(this, 'BuildProject', {
      projectName: `${agentName}-builder`,
      description: 'Build and deploy Bedrock AgentCore agent',
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true, // Docker ビルドに必要
      },
      environmentVariables: {
        AWS_ACCOUNT_ID: { value: account },
        AWS_DEFAULT_REGION: { value: region },
        ECR_REPOSITORY_URI: { value: this.repository.repositoryUri },
        AGENT_NAME: { value: agentName },
        EXECUTION_ROLE_ARN: { value: this.executionRole.roleArn },
      },
      source: codebuild.Source.s3({
        bucket: this.sourceAsset.bucket,
        path: this.sourceAsset.s3ObjectKey,
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              python: '3.12',
            },
            commands: [
              'echo "Installing bedrock-agentcore CLI..."',
              'pip install bedrock-agentcore',
            ],
          },
          pre_build: {
            commands: [
              'echo "Logging in to ECR..."',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'export IMAGE_TAG=$(date +%Y%m%d%H%M%S)',
              'echo "Image tag: $IMAGE_TAG"',
            ],
          },
          build: {
            commands: [
              'echo "Building Docker image..."',
              'docker build -t $ECR_REPOSITORY_URI:$IMAGE_TAG -t $ECR_REPOSITORY_URI:latest .',
              'echo "Pushing Docker image to ECR..."',
              'docker push $ECR_REPOSITORY_URI:$IMAGE_TAG',
              'docker push $ECR_REPOSITORY_URI:latest',
            ],
          },
          post_build: {
            commands: [
              'echo "Deploying Bedrock AgentCore agent..."',
              'echo "Build completed successfully"',
              'echo "ECR Image: $ECR_REPOSITORY_URI:$IMAGE_TAG"',
            ],
          },
        },
      }),
      timeout: Duration.minutes(30),
    });

    // CodeBuild に ECR プッシュ権限を付与
    this.repository.grantPullPush(this.codeBuildProject);

    // CodeBuild に S3 読み取り権限を付与
    this.sourceAsset.grantRead(this.codeBuildProject);

    // CodeBuild に Bedrock AgentCore 操作権限を付与
    this.codeBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'BedrockAgentCoreOperations',
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:*',
          'bedrock-agentcore:*',
        ],
        resources: ['*'],
      })
    );

    // CodeBuild に IAM PassRole 権限を付与
    this.codeBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        sid: 'IAMPassRole',
        effect: iam.Effect.ALLOW,
        actions: ['iam:PassRole'],
        resources: [this.executionRole.roleArn],
      })
    );

    // 自動ビルドが有効な場合、カスタムリソースでビルドをトリガー
    if (autoBuild) {
      const triggerBuildFunction = new lambda.Function(this, 'TriggerBuildFunction', {
        runtime: lambda.Runtime.PYTHON_3_12,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
import boto3
import cfnresponse
import time

def handler(event, context):
    codebuild = boto3.client('codebuild')
    project_name = event['ResourceProperties']['ProjectName']

    if event['RequestType'] in ['Create', 'Update']:
        try:
            response = codebuild.start_build(projectName=project_name)
            build_id = response['build']['id']
            print(f"Started build: {build_id}")

            # ビルド完了を待機（最大25分）
            for _ in range(150):
                build_response = codebuild.batch_get_builds(ids=[build_id])
                build_status = build_response['builds'][0]['buildStatus']
                print(f"Build status: {build_status}")

                if build_status == 'SUCCEEDED':
                    cfnresponse.send(event, context, cfnresponse.SUCCESS, {
                        'BuildId': build_id,
                        'Status': 'SUCCEEDED'
                    })
                    return
                elif build_status in ['FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT']:
                    cfnresponse.send(event, context, cfnresponse.FAILED, {
                        'BuildId': build_id,
                        'Status': build_status
                    })
                    return

                time.sleep(10)

            cfnresponse.send(event, context, cfnresponse.FAILED, {
                'BuildId': build_id,
                'Status': 'TIMEOUT'
            })
        except Exception as e:
            print(f"Error: {str(e)}")
            cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': str(e)})
    else:
        cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
`),
        timeout: Duration.minutes(30),
      });

      // Lambda に CodeBuild 操作権限を付与
      triggerBuildFunction.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'codebuild:StartBuild',
            'codebuild:BatchGetBuilds',
          ],
          resources: [this.codeBuildProject.projectArn],
        })
      );

      // カスタムリソースでビルドをトリガー
      new CustomResource(this, 'TriggerBuild', {
        serviceToken: triggerBuildFunction.functionArn,
        properties: {
          ProjectName: this.codeBuildProject.projectName,
          // ソースが変更されたら再ビルドをトリガー
          SourceHash: this.sourceAsset.assetHash,
        },
      });
    }

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

    new CfnOutput(this, 'CodeBuildProjectName', {
      value: this.codeBuildProject.projectName,
      description: 'CodeBuild Project Name',
      exportName: `${Stack.of(this).stackName}-AgentCodeBuildProject`,
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
