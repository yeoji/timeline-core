/**
 * This Lambda function retrieves the posts for a specific user
 *
 * Created by jq on 1/10/2016.
 */

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();

var DYNAMODB_USERS_TABLE = "timeline-users";

exports.handle = function (e, ctx, cb) {
    console.log("Retrieving posts for user: " + e.username);

    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        FilterExpression: "Username = :username",
        ExpressionAttributeValues: {
            ":username": {
                S: e.username
            }
        }
    };

    dynamodb.scan(params, function (err, data) {
        if (err) console.log(err, err.stack);
        else {
            if(data.Items.length > 0) {
                cb(null, {
                    success: true,
                    posts: (data.Items[0].Posts ? data.Items[0].Posts.SS : [])
                });
            } else {
                cb(null, {
                    success: false,
                    message: "User " + e.username + " not found!"
                });
            }
        }
    });

};