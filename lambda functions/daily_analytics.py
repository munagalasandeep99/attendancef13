import json
import boto3
from boto3.dynamodb.conditions import Key # Still useful for FilterExpression

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('daily_attendance') # Your DynamoDB table name

def lambda_handler(event, context):
    try:
        # Assuming date comes in event body for API Gateway or directly
        query_date = event.get('date')
        if not query_date:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Date parameter is missing'})
            }

        # *** CHANGE HERE: Using scan with FilterExpression instead of query with IndexName ***
        response = table.scan(
            FilterExpression=Key('date').eq(query_date)
        )
        items = response.get('Items', [])

        present_employees = []
        for item in items:
            present_employees.append({
                'firstName': item.get('firstName'),
                'lastName': item.get('lastName'),
                'time': item.get('time')
            })

        return {
            'statusCode': 200,
            'body': json.dumps({
                'date': query_date,
                'totalPresent': len(present_employees),
                'presentEmployees': present_employees
            })
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }