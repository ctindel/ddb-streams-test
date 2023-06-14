import boto3
from botocore import exceptions
import uuid
import datetime
import time
import os
import threading
import signal
import queue

DDB_ITEM_COUNT=100000
if 'DDB_ITEM_COUNT' in os.environ:
    DDB_ITEM_COUNT = int(os.environ['DDB_ITEM_COUNT'])

DDB_WRITER_THREADS=10
if 'DDB_WRITER_THREADS' in os.environ:
    DDB_WRITER_THREADS = int(os.environ['DDB_WRITER_THREADS'])

DDB_TABLE_NAME = ''
if 'DDB_TABLE_NAME' in os.environ:
    DDB_TABLE_NAME = os.environ['DDB_TABLE_NAME']
else:
    raise Exception("ERROR: You must define the DDB_TABLE_NAME environment variable")

threads = []


def debugInfo():
    print('Running ddb_writer against table %s with %d threads inserting %d items' % \
        (DDB_TABLE_NAME, DDB_WRITER_THREADS, DDB_ITEM_COUNT))

def create_client():
    with boto3_client_lock:
        return boto3.resource('dynamodb')

def signalHandler(sig, frame):
    for t in threads:
        t['queue'].put('TERMINATING')

class WorkerThread (threading.Thread):
    def __init__(self, threadId, name, queue, ddbClient):
        threading.Thread.__init__(self)
        self.threadId = threadId
        self.name = name
        self.queue = queue
        self.ddbClient = ddbClient
        self.remainingItems = DDB_ITEM_COUNT / DDB_WRITER_THREADS

    def makeNewItem(self):
        return {
            'pk': str(uuid.uuid4()),
            'insertTime': datetime.datetime.now().isoformat() + 'Z'
        }
    

    def run(self):
        print ("Starting " + self.name)
        table = self.ddbClient.Table(DDB_TABLE_NAME)
        nextItem = self.makeNewItem()
        while self.queue.empty() and self.remainingItems > 0 :
            try:
                put_response = table.put_item(
                   Item=nextItem,
                   ConditionExpression='attribute_not_exists(pk)'
                )
                if put_response['ResponseMetadata']['HTTPStatusCode'] != 200:
                    print(put_response)
                    time.sleep(1)
                else:
                    nextItem = self.makeNewItem()
                    self.remainingItems = self.remainingItems - 1
            except exceptions.ClientError as e:
                if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                    # If item was inserted successfully, but failed because a retry
                    #  hit the ConditionExpression we'll count it as successfully
                    #  inserted.
                    nextItem = self.makeNewItem()
                    self.remainingItems = self.remainingItems - 1
                else:
                    print(e)
                    time.sleep(1)
            except BaseException as e:
                print(e)
                time.sleep(1)
        print ("Exiting " + self.name)

signal.signal(signal.SIGINT, signalHandler)
debugInfo()

for x in range(DDB_WRITER_THREADS):
    threadDict = dict()
    q = queue.Queue()
    thread = WorkerThread(x, "Thread-" + str(x), q, boto3.resource('dynamodb'))
    thread.start()
    threadDict['thread'] = thread
    threadDict['queue'] = q
    threads.append(threadDict)

# Wait for all threads to complete 
for t in threads:
    t['thread'].join()

print("All threads have completed")
