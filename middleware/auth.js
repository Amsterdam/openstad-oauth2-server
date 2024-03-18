const { body, validationResult }  = require('express-validator')
const loginFields = require('../config/user').loginFields;
const db = require('../db');

exports.validateLogin = async(req, res, next) => {

  await body('email').isEmail().run(req);
  await body('password').isLength({ min: 6 }).run(req);
  const result = validationResult(req);

  if (result.errors && result.errors.length) {
    req.flash('error', result.errors);
    res.redirect(req.header('Referer') || `${process.env.APP_URL}/account`);
  } else {
    next();
  }
}

exports.check = (req, res, next) => {
  console.log("==> Running auth middleware 'check'")
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    console.log("==> Mxw auth 'check': request is niet authenticated")
    let url = '/login?clientId=' + req.client.clientId;

    // Set complete URL including domain for Amsterdam Azure implementation - 31415
    url = process.env.APP_URL + '/' + url

    console.log(`==> Dus de nieuwe URL met domein is dan: ${url}`)

    if (req.query.redirect_uri) {
      url =  url + '&redirect_uri=' + encodeURIComponent(req.query.redirect_uri);
    }

    if (req.session) {
      req.session.returnTo = req.originalUrl || req.url;
      console.log("==> Mw auth 'check', req.session: ", req.session)
    }
    console.log("==> Mw auth 'check' gaat redirecten naar: ", url)
    return res.redirect(url);
  } else {
    console.log("==> Mw auth 'check' is authenticated, gaat user zoeken in db")
    db.User
      .findOne({ where: { id: req.user.id } })
      .then((user) => {
        req.user = user;
        console.log("==> My auth 'check' heeft een user gevonden: ", req.user)
        next();
      })
      .catch((err) => {
        console.log("==> My auth 'check' heeft geen user gevonden: ", err)
        next(err);
      });
  }
}

exports.passwordValidate = (req, res, next) => {
  if (req.body.password.length >= 8) {
    next();
  } else {
    req.flash('error', {msg: 'Wachtwoord moet min 8 karakters lang zijn'});
    res.redirect(req.header('Referer') || `${process.env.APP_URL}/account`);
  }
}
