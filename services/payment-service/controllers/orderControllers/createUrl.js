const moment = require('moment');
const config = require('config');
const querystring = require('qs');
const crypto = require("crypto");
const dotenv = require('dotenv');
const pendingStore = require('../../pending-store');
dotenv.config();

// Hàm phụ trợ sortObject
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

/**
 * Cập nhật hàm createOrder để nhận orderID từ bên ngoài
 */
async function createOrder(orderId, status, amount) {
    // Chú ý: Thêm cột orderID vào câu lệnh INSERT
    const sql = `INSERT INTO Orders (orderID, status, amount) VALUES (?, ?, ?)`;
    
    try {
        await db.query(sql, [orderId, status, amount]);
        console.log(`--- Đã lưu đơn hàng ${orderId} vào DB ---`);
        return true;
    } catch (error) {
        console.error('Lỗi khi lưu đơn hàng:', error.message);
        throw error;
    }
}

// Controller xử lý tạo link thanh toán (Chuyển sang async)
exports.createPaymentUrl = async (req, res, next) => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    
    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress;

    let tmnCode = config.get('vnp_TmnCode');
    let secretKey = config.get('vnp_HashSecret');
    let vnpUrl = config.get('vnp_Url');
    let returnUrl = config.get('vnp_ReturnUrl');
    
    // NHẬN ORDERID TỪ SERVICE KHÁC (Qua body request)
    // Nếu không có, bạn có thể để fallback là logic cũ hoặc báo lỗi
    let orderId = req.body.orderId || moment(date).format('DDHHmmss'); 
    let amount = req.body.amount;
    let bankCode = req.body.bankCode;
    // Allow override from request body so callers can set their own return URL
    if (req.body.returnUrl) returnUrl = req.body.returnUrl;

    // Save userId so IPN handler can resolve it later
    const userId = req.body.userId;
    if (userId) pendingStore.save(orderId, userId, amount)
    
    let locale = req.body.language || 'vn';
    let currCode = 'VND';
    
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    
    if (bankCode !== null && bankCode !== '' && bankCode !== undefined) {
        vnp_Params['vnp_BankCode'] = bankCode;
    }

    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

    try {
        // GỌI HÀM LƯU VÀO DB TRƯỚC KHI TRẢ VỀ URL
    //    await createOrder(orderId, 'pending', amount);
        
        // Trả kết quả về cho Client
        res.status(200).json({ 
            paymentUrl: vnpUrl, 
            orderId: orderId, 
            amount: amount 
        });
    } catch (dbError) {
        // Xử lý lỗi nếu không lưu được vào Database
        res.status(500).json({ message: "Không thể khởi tạo đơn hàng", error: dbError.message });
    }
};