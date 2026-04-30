const crypto = require("crypto");

function sortObject(obj) {
  const sorted = {};
  const keys = [];

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      keys.push(encodeURIComponent(key));
    }
  }

  keys.sort();
  for (const key of keys) {
    sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, "+");
  }

  return sorted;
}

function getClientIp(req) {
  return req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    "";
}

function sha512(data, secretKey) {
  const hmac = crypto.createHmac("sha512", secretKey);
  return hmac.update(Buffer.from(data, "utf-8")).digest("hex");
}

module.exports = {
  getClientIp,
  sha512,
  sortObject,
};
