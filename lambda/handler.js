var aws = require("aws-sdk");
const ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});

exports.handler = function(event, context, callback) {
    console.log(JSON.stringify(event, null, 2));
    
    if (event.Records.length !== 1) {
        return callback("ERROR: This lambda function can only handle 1 event at a time", null);
    }
    
    event.Records.forEach(function(record) {
        //console.log(record.eventID);
        //console.log(record.eventName);
        console.log('DynamoDB Record: %j', record.dynamodb);
    });
    
    var record = event.Records[0];
    
    if (record.eventName == 'INSERT') {
        var now = new Date()
        var pk = record.dynamodb.NewImage.pk.S;
        var insertTime = new Date(record.dynamodb.NewImage.insertTime.S);
        var processTimeMS = now - insertTime;
        var msg;
        
        var params = {
            TableName: record.eventSourceARN.split(':')[5].split('/')[1],
            Key: {'pk': {'S': record.dynamodb.NewImage.pk.S}},
            UpdateExpression: 'SET updateTime = :updateTime, processTimeMS = :processTimeMS',
            ExpressionAttributeValues: {
                ":updateTime":{ "S": now.toISOString()}, 
                ":processTimeMS": { "N" : processTimeMS.toString() }
            }
        };
        ddb.updateItem(params, function(err, data) {
            if (err) {
                msg = "Error with updateItem on pk " + pk + ": " + err;
                console.log(msg);
                return callback(msg);
            }
            return callback(null);
        });
    } else {
        return callback(null, "No work to do on " + record.eventName + " event");
    }
};
