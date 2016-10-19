/**
 * Created by jq on 15/10/2016.
 */

var AWS = require("aws-sdk");
var s3 = new AWS.S3();
var lambda = new AWS.Lambda();

var atob = require("atob");

var S3_BUCKET = 'timeline-user-files';

exports.handle = function (e, ctx, cb) {
    console.log("Saving image in S3 for user: " + e.params.path.username);
    var body = e['body-json'];

    var filePath = e.params.path.username + '/images/' + body.FileName;

    var blob = dataURItoBlob(body.Image);

    // images should be publicly accessible
    var params = {ACL: 'public-read', Bucket: S3_BUCKET, Key: filePath, Body: blob};

    // Upload image to S3
    s3.upload(params, function (err, data) {
        console.log(err, data);
        if (!err) {
            // save image as an image post to user's blog
            createNewImagePost(body.MobileNo, data.Location);

            cb(null, {
                success: true
            });
        } else {
            cb(null, {
                success: false,
                message: 'Could not upload image to TimeJar.'
            });
        }
    });

};

function createNewImagePost(mobileNo, imageKey) {
    var params = {
        FunctionName: "timeline_new_post",
        Payload: JSON.stringify({
            MobileNo: mobileNo,
            Type: 'image',
            Content: imageKey
        })
    };

    lambda.invoke(params, function (err, data) {
        if (err) console.log(err, err.stack);
    });
}

/**
 * Source: https://gist.github.com/fupslot/5015897
 * @param dataURI
 * @param callback
 * @returns {*}
 */
function dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    // write the ArrayBuffer to a blob, and you're done
    var bb = new Buffer(ia.buffer);
    return bb;
}