import boto3
from botocore.exceptions import ClientError
from datetime import datetime

# AWS clients
rekognition = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')

# Constants
REK_COLLECTION = 'people'
PEOPLE_TABLE_NAME = 'people'
ATTENDANCE_TABLE_NAME = 'daily_attendance'
MATCH_THRESHOLD = 90

# Table references
people_table = None
attendance_table = None

def ensure_tables():
    global people_table, attendance_table

    # Ensure people table exists
    try:
        dynamodb.meta.client.describe_table(TableName=PEOPLE_TABLE_NAME)
    except ClientError as e:
        raise RuntimeError(f"People table missing: {e}")

    people_table = dynamodb.Table(PEOPLE_TABLE_NAME)

    # Ensure attendance table exists
    try:
        dynamodb.meta.client.describe_table(TableName=ATTENDANCE_TABLE_NAME)
        print(f"Table '{ATTENDANCE_TABLE_NAME}' already exists.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"Creating DynamoDB table '{ATTENDANCE_TABLE_NAME}'...")
            table = dynamodb.create_table(
                TableName=ATTENDANCE_TABLE_NAME,
                KeySchema=[
                    {'AttributeName': 'employeeId', 'KeyType': 'HASH'},
                    {'AttributeName': 'timestamp',  'KeyType': 'RANGE'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'employeeId', 'AttributeType': 'S'},
                    {'AttributeName': 'timestamp',  'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            table.wait_until_exists()
            print(f"Table '{ATTENDANCE_TABLE_NAME}' created.")
        else:
            raise
    attendance_table = dynamodb.Table(ATTENDANCE_TABLE_NAME)

def has_attendance_today(employee_id, date_str):
    try:
        response = attendance_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('employeeId').eq(employee_id),
            FilterExpression=boto3.dynamodb.conditions.Attr('date').eq(date_str)
        )
        return response['Count'] > 0
    except ClientError as e:
        print(f"Error checking attendance: {e}")
        return False

def lambda_handler(event, context):
    if people_table is None or attendance_table is None:
        ensure_tables()

    record = event['Records'][0]['s3']
    bucket = record['bucket']['name']
    key = record['object']['key']
    print(f"Processing image s3://{bucket}/{key}")

    rek_resp = rekognition.search_faces_by_image(
        CollectionId=REK_COLLECTION,
        Image={'S3Object': {'Bucket': bucket, 'Name': key}},
        MaxFaces=1,
        FaceMatchThreshold=MATCH_THRESHOLD
    )

    matches = rek_resp.get('FaceMatches', [])
    if not matches:
        print("No matching face found.")
        return {'status': 'NoMatch'}

    face_id = matches[0]['Face']['FaceId']

    emp_resp = people_table.get_item(Key={'rekognitionId': face_id})
    if 'Item' not in emp_resp:
        print(f"FaceId {face_id} not registered in people table.")
        return {'status': 'UnknownEmployee'}

    emp = emp_resp['Item']
    now = datetime.utcnow()
    iso_ts = now.isoformat()
    date_str = now.strftime('%Y-%m-%d')
    dow = now.strftime('%A')
    time_str = now.strftime('%H:%M:%S')

    # Skip duplicate for today
    if has_attendance_today(face_id, date_str):
        print(f"Attendance already recorded today for {emp.get('firstName')} {emp.get('lastName')}")
        return {
            'status': 'AlreadyExists',
            'employee': f"{emp.get('firstName')} {emp.get('lastName')}",
            'date': date_str
        }

    # Write attendance
    attendance_table.put_item(Item={
        'employeeId': face_id,
        'timestamp': iso_ts,
        'date': date_str,
        'dayOfWeek': dow,
        'time': time_str,
        'firstName': emp.get('firstName'),
        'lastName': emp.get('lastName')
    })

    print(f"Attendance logged for {emp.get('firstName')} {emp.get('lastName')} at {iso_ts}")
    return {
        'status': 'Success',
        'employee': f"{emp.get('firstName')} {emp.get('lastName')}",
        'timestamp': iso_ts
    }
