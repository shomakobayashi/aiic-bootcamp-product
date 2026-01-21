import requests

def execute_api(api_url: str, method: str = "GET", headers: dict = None, params: dict = None, body: dict = None) -> dict:
    response = requests.request(method=method, url=api_url, headers=headers, params=params, json=body)
    return {"status_code": response.status_code, "body": response.json() if response.text else None}
