import json
import boto3

lambda_client = boto3.client('lambda')

def invoke_lambda(function_name: str, payload: dict, invocation_type: str = "RequestResponse") -> dict:
    response = lambda_client.invoke(
        FunctionName=function_name,
        InvocationType=invocation_type,
        Payload=json.dumps(payload)
    )
    return json.loads(response['Payload'].read())

def get_lambda_code(function_name: str) -> str:
    response = lambda_client.get_function(FunctionName=function_name)
    return response['Code']['Location']

def list_lambdas() -> list:
    response = lambda_client.list_functions()
    return [func['FunctionName'] for func in response['Functions']]
