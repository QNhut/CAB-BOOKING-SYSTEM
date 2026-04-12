const config = require('config');
const crypto = require("crypto");
const qs = require('qs');
const pendingStore = require('../../pending-store');
const { publishPaymentEvent } = require('../../kafka');

function sortObject(obj) {
    let sorted = {};
    let str = [];
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (let key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

const vnpayIpn = async (req, res, next) => {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    let orderId  = vnp_Params['vnp_TxnRef'];          // == bookingId passed from frontend
    let rspCode  = vnp_Params['vnp_ResponseCode'];
    let vnpAmount = Number(vnp_Params['vnp_Amount']); // VNPay sends amount * 100
    let transactionNo = vnp_Params['vnp_TransactionNo'] || '';
    let bankCode  = vnp_Params['vnp_BankCode'] || '';

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    let secretKey = config.get('vnp_HashSecret');
    let signData = qs.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");

    // 1. Verify HMAC signature
    if (secureHash !== signed) {
        console.warn(`[IPN] checksum failed for orderId=${orderId}`);
        return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
    }

    // 2. Look up userId from in-memory store (saved when createPaymentUrl was called)
    const pending = pendingStore.get(orderId);
    const userId  = pending?.userId || null;
    const amountVnd = Math.round(vnpAmount / 100); // convert back from VNPay x100 format

    const success = (rspCode === '00');
    const eventType = success ? 'PAYMENT_COMPLETED' : 'PAYMENT_FAILED';

    // 3. Publish Kafka event so notification-service can push SSE to the user
    try {
        await publishPaymentEvent(eventType, {
            orderId,
            userId,
            amount: amountVnd,
            currency: 'VND',
            rspCode,
            transactionNo,
            bankCode,
            paidAt: new Date().toISOString(),
        });

        if (success) {
            pendingStore.remove(orderId); // clean up after successful payment
            console.log(`[IPN] PAYMENT_COMPLETED orderId=${orderId} userId=${userId} amount=${amountVnd}`);
        } else {
            console.log(`[IPN] PAYMENT_FAILED orderId=${orderId} rspCode=${rspCode}`);
        }
    } catch (kafkaErr) {
        // Don't let Kafka errors fail the IPN — VNPay will retry if we don't respond 00
        console.error('[IPN] Kafka publish error:', kafkaErr.message);
    }

    // 4. Always respond 00 to VNPay so it stops retrying
    return res.status(200).json({ RspCode: '00', Message: 'Success' });
};

module.exports = { vnpayIpn };
module.exports = {
    vnpayIpn
};