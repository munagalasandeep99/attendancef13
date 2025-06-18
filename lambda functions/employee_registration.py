import boto3
import time
from botocore.exceptions import ClientError

# AWS clients
s3 = boto3.client('s3')
rekognition = boto3.client('rekognition')
dynamodb = boto3.resource('dynamodb')

# Constants
DYNAMODB_TABLE_NAME = 'people'
REKOGNITION_COLLECTION = 'people'  # changed from 'employees' to 'people'

# Get table reference
employeeTable = dynamodb.Table(DYNAMODB_TABLE_NAME)


def lambda_handler(event, context):
    print(event)
    
    ensure_dynamodb_table()
    ensure_rekognition_collection()

    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']

    try:
        response = index_employee_image(bucket, key)
        print(response)
        if response['ResponseMetadata']['HTTPStatusCode'] == 200 and response['FaceRecords']:
            faceId = response['FaceRecords'][0]['Face']['FaceId']
            name = key.split('.')[0].split('_')
            firstName = name[0]
            lastName = name[1] if len(name) > 1 else ''
            register_employee(faceId, firstName, lastName)
        else:
            print(f"No face detected or error indexing image: {key}")
        return response
    except Exception as e:
        print(e)
        print(f"Error processing employee image {key} from bucket {bucket}.")
        raise e


def ensure_dynamodb_table():
    try:
        dynamodb.meta.client.describe_table(TableName=DYNAMODB_TABLE_NAME)
        print(f"Table '{DYNAMODB_TABLE_NAME}' already exists.")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"Creating DynamoDB table '{DYNAMODB_TABLE_NAME}'...")
            table = dynamodb.create_table(
                TableName=DYNAMODB_TABLE_NAME,
                KeySchema=[
                    {'AttributeName': 'rekognitionId', 'KeyType': 'HASH'}
                ],
                AttributeDefinitions=[
                    {'AttributeName': 'rekognitionId', 'AttributeType': 'S'}
                ],
                BillingMode='PAY_PER_REQUEST'
            )
            table.wait_until_exists()
            print("Table created and ready.")
        else:
            raise


def ensure_rekognition_collection():
    collections = rekognition.list_collections()['CollectionIds']
    if REKOGNITION_COLLECTION not in collections:
        print(f"Creating Rekognition collection '{REKOGNITION_COLLECTION}'...")
        rekognition.create_collection(CollectionId=REKOGNITION_COLLECTION)
        print("Collection created.")
    else:
        print(f"Rekognition collection '{REKOGNITION_COLLECTION}' already exists.")


def index_employee_image(bucket, key):
    response = rekognition.index_faces(
        CollectionId=REKOGNITION_COLLECTION,  # now 'people'
        Image={
            'S3Object': {
                'Bucket': bucket,
                'Name': key
            }
        }
    )
    return response


def register_employee(faceId, firstName, lastName):
    employeeTable.put_item(
        Item={
            'rekognitionId': faceId,
            'firstName': firstName,
            'lastName': lastName
        }
    )
