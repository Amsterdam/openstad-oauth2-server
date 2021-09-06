const authType = 'Url';
const passport = require('passport');
const tokenUrl = require('../../services/tokenUrl');
const authService = require('../../services/authService');
const verificationService = require('../../services/verificationService');

exports.postLogin = async (req, res, next) => {

  try {
    const clientConfig = req.client.config ? req.client.config : {};
    req.redirectUrl = clientConfig && clientConfig.emailRedirectUrl ? clientConfig.emailRedirectUrl : encodeURIComponent(req.query.redirect_uri);

    try {
      req.user = await authService.validatePrivilegeUser(req.body.email,  req.client.id);

      await verificationService.sendVerification(req.user, req.client, req.redirectUrl, true);

      req.flash('success', { msg: 'De e-mail is verstuurd naar: ' + req.user.email });

      return res.redirect('/auth/admin/url/confirmation?clientId=' + req.client.clientId +'&redirect_uri='+ req.redirectUrl);
    } catch(err) {
      console.log(err)
      req.flash('error', { msg: 'U heeft geen rechten om deze actie uit te voeren.' });

      return res.redirect('/auth/admin/url/login?clientId=' + req.client.clientId +'&redirect_uri='+ req.redirectUrl);
    }
  } catch (err) {
    console.log('===> err', err);
    req.flash('error', { msg: 'Het is niet gelukt om de e-mail te versturen!' });

    return res.redirect(req.header('Referer') || authUrlConfig.loginUrl);
  }
};

exports.confirmation  = (req, res) => {
  const config = req.client.config ? req.client.config : {};
  const configAuthType = config.authTypes && config.authTypes[authType] ? config.authTypes[authType] : {};

  res.render('auth/url/confirmation', {
    clientId: req.query.clientId,
    client: req.client,
    loginUrl: '/auth/admin/url/login',
    redirectUrl: encodeURIComponent(req.query.redirect_uri),
    title: configAuthType && configAuthType.confirmedTitle ? configAuthType.confirmedTitle : false,
    description: configAuthType && configAuthType.confirmedDescription ?  configAuthType.confirmedDescription : false,
  });
};

exports.postAuthenticate = (req, res, next) => {
  passport.authenticate('url', { session: true }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    const redirectUrl = req.query.redirect_uri ? encodeURIComponent(req.query.redirect_uri) : req.client.redirectUrl;

    // Redirect if it fails to the original e-mail screen
    if (!user) {
      req.flash('error', { msg: 'De url is geen geldige login url, wellicht is deze verlopen' });
      return res.redirect(`/auth/admin/url/login?clientId=${req.client.clientId}&redirect_uri=${redirectUrl}`);
    }

    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }

      return tokenUrl.invalidateTokensForUser(user.id)
        .then((response) => {
          const redirectToAuthorisation = () => {
            // Redirect if it succeeds to authorize screen
            //check if allowed url will be done by authorize screen
            const authorizeUrl = `/dialog/authorize?redirect_uri=${redirectUrl}&response_type=code&client_id=${req.client.clientId}&scope=offline`;
            return res.redirect(authorizeUrl);
          };

          req.brute.reset(() => {
            //log the succesfull login
            authService.logSuccessFullLogin(req)
              .then(() => {
                redirectToAuthorisation();
              })
              .catch(() => {
                redirectToAuthorisation();
              });
          });
        })
        .catch((err) => {
          next(err);
        });
    });
  })(req, res, next);
};
