const config = require('config');
const qs = require('qs');
const pendingStore = require('../../pending-store');
const { publishPaymentEvent } = require('../../kafka');
const { sha512, sortObject } = require('../../lib/vnpay');
const { createLogger } = require('../../../../shared/logger.cjs');
const log = createLogger('payment-service');


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
    let signed = sha512(signData, secretKey);

    // 1. Verify HMAC signature
    if (secureHash !== signed) {
        log.warn('payment_ipn_checksum_failed', { order_id: orderId });
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
            bookingId: orderId,
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
            log.info('payment_ipn_completed', { order_id: orderId, user_id: userId, amount: amountVnd });
        } else {
            log.warn('payment_ipn_failed', { order_id: orderId, rsp_code: rspCode });
        }
    } catch (kafkaErr) {
        // Don't let Kafka errors fail the IPN — VNPay will retry if we don't respond 00
        log.error('payment_ipn_kafka_publish_error', { error: kafkaErr.message, order_id: orderId });
    }

    // 4. Always respond 00 to VNPay so it stops retrying
    return res.status(200).json({ RspCode: '00', Message: 'Success' });
};

module.exports = {
    vnpayIpn
};
