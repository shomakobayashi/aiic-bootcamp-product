import logging
import sys

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models import BedrockModel
from strands.tools import tool

from tools.lambda_tool import invoke_lambda, get_lambda_code, list_lambdas
from tools.dynamodb_tool import create_item, read_item, update_item, query_items
from tools.apigateway_tool import execute_api

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()

bedrock_model = BedrockModel(
    model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
    temperature=0.7,
)

@tool
def lambda_invoke(function_name: str, payload: dict, invocation_type: str = "RequestResponse") -> dict:
    """AWS Lambda関数を実行します"""
    return invoke_lambda(function_name, payload, invocation_type)

@tool
def lambda_get_code(function_name: str) -> str:
    """Lambda関数のソースコードURLを取得します"""
    return get_lambda_code(function_name)

@tool
def lambda_list() -> list:
    """Lambda関数の一覧を取得します"""
    return list_lambdas()

@tool
def dynamodb_create(table_name: str, item: dict) -> str:
    """DynamoDBテーブルにアイテムを作成します"""
    return create_item(table_name, item)

@tool
def dynamodb_read(table_name: str, key: dict) -> dict:
    """DynamoDBテーブルからアイテムを取得します"""
    return read_item(table_name, key)

@tool
def dynamodb_update(table_name: str, key: dict, updates: dict) -> str:
    """DynamoDBテーブルのアイテムを更新します"""
    return update_item(table_name, key, updates)

@tool
def dynamodb_query(table_name: str, key_condition: str, expr_attr_values: dict) -> list:
    """DynamoDBテーブルをクエリします"""
    return query_items(table_name, key_condition, expr_attr_values)

@tool
def api_execute(api_url: str, method: str = "GET", headers: dict = None, params: dict = None, body: dict = None) -> dict:
    """API Gatewayエンドポイントを実行します"""
    return execute_api(api_url, method, headers, params, body)

@app.entrypoint
def run_agent(payload):
    user_input = payload.get("prompt", "List all Lambda functions")
    logger.info(f"User input: {user_input}")
    
    custom_tools = [
        lambda_invoke, lambda_get_code, lambda_list,
        dynamodb_create, dynamodb_read, dynamodb_update, dynamodb_query,
        api_execute
    ]
    
    agent = Agent(
        tools=custom_tools,
        model=bedrock_model,
        system_prompt="You are a tester."
    )
    
    response = agent(user_input)
    return response.message["content"][0]["text"]

if __name__ == "__main__":
    app.run()