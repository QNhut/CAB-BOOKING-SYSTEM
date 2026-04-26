const qs = require("qs");
const { sha512, sortObject } = require("../../lib/vnpay");

function verifyParams(input) {
  const params = { ...input };
  const secureHash = params.vnp_SecureHash;

  delete params.vnp_SecureHash;
  delete params.vnp_SecureHashType;

  const sortedParams = sortObject(params);
  const config = require("config");
  const secretKey = config.get("vnp_HashSecret");
  const signData = qs.stringify(sortedParams, { encode: false });
  const signed = sha512(signData, secretKey);
  const responseCode = sortedParams.vnp_ResponseCode || "97";

  return {
    success: secureHash === signed && responseCode === "00",
    checksumValid: secureHash === signed,
    code: responseCode,
    orderId: sortedParams.vnp_TxnRef || null,
    amount: sortedParams.vnp_Amount
      ? Math.round(Number(sortedParams.vnp_Amount) / 100)
      : null,
    transactionNo: sortedParams.vnp_TransactionNo || null,
    bankCode: sortedParams.vnp_BankCode || null,
  };
}

exports.vnpayReturn = (req, res) => {
  const result = verifyParams(req.query);
  res.render("success", { code: result.checksumValid ? result.code : "97" });
};

exports.verifyReturn = (req, res) => {
  const result = verifyParams(req.body || {});
  return res.status(result.checksumValid ? 200 : 400).json(result);
};
