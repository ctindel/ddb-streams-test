import boto3
import uuid
import datetime
import pprint

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('ddb-streams-test')
item = {
    'pk': str(uuid.uuid4()),
    'insertTime': datetime.datetime.now()
}
#response = table.put_item(
   #Item=item
#)


#return response

