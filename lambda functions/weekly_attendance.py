import json
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('daily_attendance') # Replace with your DynamoDB table name

def get_week_range(start_date_str):
    # start_date_str format: YYYY-MM-DD
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
    # Find the start of the week (e.g., Monday)
    # You might need to adjust this based on your definition of start of week
    start_of_week = start_date - timedelta(days=start_date.weekday()) # Monday is 0
    end_of_week = start_of_week + timedelta(days=6)
    return [start_of_week.strftime('%Y-%m-%d'), end_of_week.strftime('%Y-%m-%d')]

def lambda_handler(event, context):
    try:
        query_date = event.get('date') # This date will be used to determine the week
        if not query_date:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Date parameter is missing'})
            }

        week_start, week_end = get_week_range(query_date)

        # Scan or Query based on date range (scan is generally not recommended for large tables)
        # A better approach would be to have a GSI on a 'weekId' or filter more efficiently.
        # For this example, we'll simulate fetching all and filtering.
        # In production, optimize this query.
        response = table.scan(
            FilterExpression=Key('date').between(week_start, week_end)
        )
        items = response.get('Items', [])

        # Structure data for weekly analytics
        weekly_summary = {}
        for item in items:
            employee_name = f"{item.get('firstName')} {item.get('lastName')}"
            if employee_name not in weekly_summary:
                weekly_summary[employee_name] = {
                    'totalDaysPresent': 0,
                    'attendanceDetails': []
                }
            weekly_summary[employee_name]['totalDaysPresent'] += 1
            weekly_summary[employee_name]['attendanceDetails'].append({
                'date': item.get('date'),
                'dayOfWeek': item.get('dayOfWeek'),
                'time': item.get('time')
            })

        return {
            'statusCode': 200,
            'body': json.dumps({
                'weekRange': f"{week_start} to {week_end}",
                'weeklySummary': weekly_summary
            })
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }