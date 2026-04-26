/**
 * Created by CTT VNPAY
 */

const request = require('request');
const moment = require('moment');
const config = require('config');
const { getClientIp, sha512 } = require('../../lib/vnpay');
const { createLogger } = require('../../../../shared/logger.cjs');
const log = createLogger('payment-service');

const querydr = (req, res, next) => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    let date = new Date();

    let vnp_TmnCode = config.get('vnp_TmnCode');
    let secretKey = config.get('vnp_HashSecret');
    let vnp_Api = config.get('vnp_Api');

    let vnp_TxnRef = req.body.orderId;
    let vnp_TransactionDate = req.body.transDate;

    let vnp_RequestId = moment(date).format('HHmmss');
    let vnp_Version = '2.1.0';
    let vnp_Command = 'querydr';
    let vnp_OrderInfo = 'Truy van GD ma:' + vnp_TxnRef;

    let vnp_IpAddr = getClientIp(req);

    let currCode = 'VND';
    let vnp_CreateDate = moment(date).format('YYYYMMDDHHmmss');

    let data = vnp_RequestId + "|" + vnp_Version + "|" + vnp_Command + "|" + vnp_TmnCode + "|" + vnp_TxnRef + "|" + vnp_TransactionDate + "|" + vnp_CreateDate + "|" + vnp_IpAddr + "|" + vnp_OrderInfo;

    let vnp_SecureHash = sha512(data, secretKey);

    let dataObj = {
        'vnp_RequestId': vnp_RequestId,
        'vnp_Version': vnp_Version,
        'vnp_Command': vnp_Command,
        'vnp_TmnCode': vnp_TmnCode,
        'vnp_TxnRef': vnp_TxnRef,
        'vnp_OrderInfo': vnp_OrderInfo,
        'vnp_TransactionDate': vnp_TransactionDate,
        'vnp_CreateDate': vnp_CreateDate,
        'vnp_IpAddr': vnp_IpAddr,
        'vnp_SecureHash': vnp_SecureHash
    };
    // /merchant_webapi/api/transaction
    request({
        url: vnp_Api,
        method: "POST",
        json: true,
        body: dataObj
    }, function (error, response, body) {
        if (error) {
            log.error('payment_querydr_error', { error: error.message, order_id: vnp_TxnRef });
            return;
        }
        log.info('payment_querydr_response', { order_id: vnp_TxnRef, status_code: response?.statusCode || null, body: body || null });
    });
};

module.exports = {
    querydr
};
