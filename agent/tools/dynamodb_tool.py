import boto3

dynamodb = boto3.resource('dynamodb')

def create_item(table_name: str, item: dict) -> str:
    table = dynamodb.Table(table_name)
    table.put_item(Item=item)
    return f"Item created in {table_name}"

def read_item(table_name: str, key: dict) -> dict:
    table = dynamodb.Table(table_name)
    response = table.get_item(Key=key)
    return response.get('Item', {})

def update_item(table_name: str, key: dict, updates: dict) -> str:
    table = dynamodb.Table(table_name)
    update_expr = "SET " + ", ".join([f"{k} = :{k}" for k in updates.keys()])
    expr_attr_values = {f":{k}": v for k, v in updates.items()}
    table.update_item(Key=key, UpdateExpression=update_expr, ExpressionAttributeValues=expr_attr_values)
    return f"Item updated in {table_name}"

def query_items(table_name: str, key_condition: str, expr_attr_values: dict) -> list:
    table = dynamodb.Table(table_name)
    response = table.query(KeyConditionExpression=key_condition, ExpressionAttributeValues=expr_attr_values)
    return response.get('Items', [])
