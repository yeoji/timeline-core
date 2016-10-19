/**
 * This Lambda function receives an SMS from Twilio
 * And parses it to either register a new blog
 * Or post content to an existing blog
 *
 * Created by jq on 30/09/2016.
 */

var AWS = require("aws-sdk");
var dynamodb = new AWS.DynamoDB();
var lambda = new AWS.Lambda();

var DYNAMODB_USERS_TABLE = "timeline-users";

console.log('Receiving SMS from Twilio');

exports.handle = function (e, ctx, cb) {
    var sms = e.params.querystring;
    console.log('Processing SMS from: ' + sms.From);

    parseSMS(sms);

    // Send an empty TwiML response back to Twilio
    cb(null, "<Response></Response>");
};

/**
 * Parses an SMS message received from Twilio
 * @param sms
 */
function parseSMS(sms) {
    console.log(sms);
    // Differentiate between a Register Blog message and a Post Blog message
    var registerRegex = /REGISTER ([A-Za-z0-9]+)/;

    // Try and find the user in our db
    findUserByMobile(sms.From)
        .then(function (data) {
            if (Object.keys(data).length != 0) {
                // Post to Blog
                console.log("Posting SMS content to blog!");
                postToBlog(sms.From, sms.Body);
            } else {
                console.log("User not found");
                // Check if message matched the register Regex
                var match;
                if (match = sms.Body.match(registerRegex)) {
                    console.log("Registering new user");
                    // Register blog with the provided username
                    registerUser(sms.From, match[1]);
                } else console.log("Message could not be processed: " + sms.Body);
            }
        });
}

/**
 * Find a user by mobile no from the DB
 * @param mobile
 * @returns {Promise}
 */
function findUserByMobile(mobile) {
    var params = {
        TableName: DYNAMODB_USERS_TABLE,
        Key: {
            MobileNo: {
                S: mobile
            }
        }
    };

    console.log("Retrieving user from DB");

    return new Promise(function (resolve, reject) {
        dynamodb.getItem(params, function (err, data) {
            if (err) console.log(err, err.stack);
            else resolve(data);
        });
    });
}

/**
 * Register a new user and blog
 * @param mobileNo
 * @param username
 */
function registerUser(mobileNo, username) {
    var params = {
        FunctionName: "timeline_register_user",
        Payload: JSON.stringify({
            MobileNo: mobileNo,
            Username: username,
            Context: "sms"
        })
    };

    lambda.invoke(params, function (err, data) {
        if (err) console.log(err, err.stack);
    });
}

/**
 * Post new content to the user with the specified mobile no's blog
 * @param mobileNo
 * @param content
 */
function postToBlog(mobileNo, content) {
    var params = {
        FunctionName: "timeline_new_post",
        Payload: JSON.stringify({
            MobileNo: mobileNo,
            Content: content,
            Type: "text"
        })
    };

    lambda.invoke(params, function (err, data) {
        if (err) console.log(err, err.stack);
    });
}