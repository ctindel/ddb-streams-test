var aws = require("aws-sdk");
const ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});

exports.handler = async function(event, context, callback) {
    console.log(JSON.stringify(event, null, 2));
    
    var putItemRequests = []
    var tableName = undefined;
    var record = undefined;
    
    for (let i=0; i < event.Records.length; i++) {
        record = event.Records[i];
        //console.log(record.eventID);
        //console.log(record.eventName);
        console.log('DynamoDB Record: %j', record.dynamodb);

        // When we do a BWI to update the item the events come as INSERT instead of MODIFY
        // So we'll skip events that already have the updateTime attribute
        if (record.eventName == 'INSERT' && !record.dynamodb.NewImage.hasOwnProperty('updateTime')) {
            if (typeof tableName == 'undefined') {
                tableName = record.eventSourceARN.split(':')[5].split('/')[1];
            }

            var now = new Date()
            var pk = record.dynamodb.NewImage.pk.S;
            var insertTime = new Date(record.dynamodb.NewImage.insertTime.S);
            var processTimeMS = now - insertTime;
            var msg;

            var putItemRequest = {
                PutRequest: {
                    Item: {
                        "pk" : {'S': record.dynamodb.NewImage.pk.S},
                        "insertTime" : {'S': record.dynamodb.NewImage.insertTime.S},
                        "updateTime":{ "S": now.toISOString()},
                        "processTimeMS": { "N" : processTimeMS.toString() }
                    }
                }
            };          
            putItemRequests.push(putItemRequest);
        } else {
            console.log("Event can be skipped");
        }
    };

    console.log("putItemRequests length = " + putItemRequests.length);
    
    if (putItemRequests.length > 0) {
        var remainingItems = putItemRequests;
        while (true) {
            var params = {
                RequestItems : {}
            };
            params.RequestItems[tableName] = remainingItems;
    
            console.log("BWI Params: %j", params);
            
            try {
                var data = await ddb.batchWriteItem(params).promise();
            } catch (err) {
                var msg;
                msg = "Error with batchWriteItem: " + err;
                console.log(msg);
                return callback(msg);
            }
            console.log(data);
            if (data.UnprocessedItems.length > 0) {
                console.log("BWI left" + data.UnprocessedItems.length + " remaining, going around the loop again");
                remainingItems = data.UnprocessedItems;
            } else {
                console.log("BWI successfully completed all items");
                return callback(null);
            }
        }
    } else {
        return callback(null);
    }
};

