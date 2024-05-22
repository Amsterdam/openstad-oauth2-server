const Netmask = require('netmask').Netmask;

exports.preventCiscoRequest = (req, res, next) => {
  
  // Fix for local IP
  if (req.ip == '::1') {
    return next();
  }
  
  // Get CIDRs from client config. If the `blockCidrs` key doesn't exist fall back to Cisco Umbrella CIDRs
  // See https://support.umbrella.com/hc/en-us/articles/360059292052-Additional-Egress-IP-Address-Range
  const blockCidrs = req && req.client && req.client.config && req.client.config.blockCidrs ? req.client.config.blockCidrs : ['146.112.0.0/16', '155.190.0.0/16', '151.186.0.0/16'];
  
  // Check if IP is in cidr
  const isIpInCidr = blockCidrs.some(cidr => {
    const block = new Netmask(cidr);
    return block.contains(req.ip);
  });
  
  if (!isIpInCidr) {
    return next();
  }
  
  console.log('IP is in CIDRs to block', req.ip, blockCidrs, isIpInCidr);
  
  req.flash('error', {msg: 'De url is geen geldige login url, wellicht is deze verlopen'});
  return res.redirect(`${process.env.APP_URL}/auth/url/login?clientId=${req.query.clientId}`);
  
}
