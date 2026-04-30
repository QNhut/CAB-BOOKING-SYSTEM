/**
 * Created by CTT VNPAY
 */

let express = require('express');
let router = express.Router();
const createurlController = require('../controllers/orderControllers/createUrl');
const vnpayreturnController = require('../controllers/orderControllers/vnpayReturn');
const vnpayIpnController = require('../controllers/orderControllers/vnpayIpn');
const querydrController = require('../controllers/orderControllers/querydr');
const refundController = require('../controllers/orderControllers/refund');


router.get('/', function(req, res, next){
    res.render('orderlist', { title: 'Danh sách đơn hàng' })
});

router.get('/create_payment_url', function (req, res, next) {
    res.render('order', {title: 'Tạo mới đơn hàng', amount: 10000})
});

router.get('/querydr', function (req, res, next) {
    
    let desc = 'truy van ket qua thanh toan';
    res.render('querydr', {title: 'Truy vấn kết quả thanh toán'})
});

router.get('/refund', function (req, res, next) {
    
    let desc = 'Hoan tien GD thanh toan';
    res.render('refund', {title: 'Hoàn tiền giao dịch thanh toán'})
});


router.post('/create_payment_url', createurlController.createPaymentUrl);
   

router.get('/vnpay_return', vnpayreturnController.vnpayReturn);

router.get('/vnpay_ipn', vnpayIpnController.vnpayIpn);

router.post('/querydr', querydrController.querydr);

router.post('/refund', refundController.refund);

module.exports = router;