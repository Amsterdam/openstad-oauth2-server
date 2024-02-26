const db = require('../db');

const hat = require('hat');
const privilegedRoles =  require('../config/roles').privilegedRoles;
const defaultRole =  require('../config/roles').defaultRole;
const getClientIdFromRequest = require('../utils/getClientIdFromRequest');
const configAuthTypes = require('../config/auth.js').types;

exports.withAll = (req, res, next) => {
  db.Client
    .findAll()
    .then((clients) => {
       req.clients = clients;
       next();
    })
    .catch((err) => { next(err); });
}

exports.withOne = async (req, res, next) => {
  console.log("==> Running client middleware 'withOne'")
  let clientId = getClientIdFromRequest(req);
  if (!clientId) { // TODO: why is this not part of getClientIdFromRequest
    clientId = req.query.client_id;
  }
  
  if (!clientId) { // TODO: why is this not part of getClientIdFromRequest
    clientId = req.params.clientId;
  }
  console.log("==> Mw client withOne got clientId: ", clientId)
 
  if (!clientId) return next('No Client ID is set for login');

  let scope = [];
  let where = { clientId: clientId }

  if(req.query.withUserRoles) {
    scope.push({ method: ['includeUserRoles', req.query.excludingRoles] })
  }

  try {
    
    let client = await db.Client.scope(scope).findOne({ where });
    console.log(`==> Mw client withOne found a client from the database, with the following config: ${client.config}`)
    if (client) {
      req.client = client;
      const clientConfig = req.client.config;
      const clientConfigStyling = clientConfig.styling ?  clientConfig.styling : {};
      
      res.locals.clientProjectUrl = clientConfig.projectUrl;
      res.locals.clientEmail = clientConfig.contactEmail;
      res.locals.clientDisclaimerUrl = clientConfig.clientDisclaimerUrl;
      res.locals.clientStylesheets = clientConfig.clientStylesheets;
      
      //if logo isset in config overwrite the .env logo
      if (clientConfigStyling && clientConfigStyling.logo) {
        res.locals.logo = clientConfigStyling.logo;
      }
      
      if (clientConfigStyling && clientConfigStyling.favicon) {
        res.locals.favicon = clientConfigStyling.favicon;
      }
      
      if (clientConfigStyling && clientConfigStyling.inlineCSS) {
        res.locals.inlineCSS = clientConfigStyling.inlineCSS;
      }
      
      if (clientConfig.displayClientName || (clientConfig.displayClientName === 'undefined' && process.env.DISPLAY_CLIENT_NAME=== 'yes')) {
        res.locals.displayClientName = true;
      }
      
      console.log(`==> Mw client withOne gaat next() aanroepen`)
      return next();

    } else {
      return next('No Client found for clientID');
    }

  } catch(err) {
    return next(err);
  }

}

/**
 * Add the login option
 */
exports.setAuthType = (authType) => {
  return (req, res, next) => {
    req.authType = authType;
    next();
  }
}

exports.validate = (req, res, next) => {

  let authTypes = req.client.authTypes || [];
  authTypes = authTypes.map((authType) => {
    let configAuthType = configAuthTypes.find(type => type.key === authType);
    return configAuthType;
  });

  // only /admin in the end should work
  if (req.params.priviligedRoute &&  req.params.priviligedRoute !== 'admin') {
    throw new Error('Priviliged route is not properly set');
  }

  const allowedType = authTypes && authTypes.length > 0 ? authTypes.find(option => option.key === req.authType) : false;

  const isPriviligedRoute = req.params.priviligedRoute === 'admin';

  /**
   * Check if any login options are defined for the client, otherwise error!
   */
  if ( !authTypes) {
    throw new Error('No auth types selected');
  }

  /**
   * Check if auth type is allowed for client
   * This is only for cosmetics, the safe checks are done in the handling
   */
  if (!isPriviligedRoute && !allowedType && req.method === 'GET') {
    throw new Error('Auth types not allowed');
  }

  next();
}

exports.checkIfEmailRequired =  (req, res, next) => {
      const requiredFields = req.client.requiredUserFields;
      const authTypes = req.client.authTypes;

      // the Local & email
      const emailAuthTypesEnabled = authTypes.indexOf('Url') !== -1 ||authTypes.indexOf('Local') !== -1;
      const emailRequired = requiredFields.indexOf('email') !== -1;
      const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

      // if UniqueCode isset
      if (emailRequired && !req.user.email) {
        if (emailAuthTypesEnabled) {
          req.emailRequiredForAuth = true;
          res.redirect(`/login?clientId=${req.client.clientId}&redirect_uri=${encodeURIComponent(req.query.redirect_uri)}`);
        } else {
          throw new Error('E-mail is required but no auth type enabled that is able to validate it properly');
        }
      } else {
        next();
      }
}


// this is an extra check to make sure a users has authenticated with an access token
// otherwise a user can access with another acces token
// not mega disaster since role is still checked
// but this is mainly an issue when members on one site can login with email
// yet on another site sms is required
// we still have checks to ensure that, but this is an extra security check on that
// in future it would be great to add something like "user requirements" to  a site
exports.checkIfAccessTokenBelongToCurrentClient =  async (req, res, next) => {
  return next();
}


exports.checkUniqueCodeAuth = (errorCallback) => {
  console.log("==> Running client middleware 'checkUniqueCodeAuth'")
  //validate code auth type
  return (req, res, next) => {
    const authTypes = req.client.authTypes;

      // if UniqueCode authentication is used, other methods are blocked to enforce users can never authorize with email
      if (authTypes.indexOf('UniqueCode') !== -1) {
        console.log(`Mw client 'checkUniqueCodeAuth, unieke code is een van de auth types. Gaat nu een unieke code in db zoeken met clientId ${req.client.id} en userId ${req.user.id}`)
        db.UniqueCode
        .findOne({ where: { clientId: req.client.id, userId: req.user.id } })
        .then((codeResponse) => {
          console.log(`Mw client 'checkUniqueCodeAuth, codeResponse is: ${codeResponse}`)
          const userHasPrivilegedRole = privilegedRoles.indexOf(req.user.role) > -1;
          console.log(`Mw client 'checkUniqueCodeAuth, userHasPrivilegedRole: ${userHasPrivilegedRole}`)
          // if uniquecode exists or user has priviliged role
          if (codeResponse || userHasPrivilegedRole) {
            console.log(`Mw client 'checkUniqueCodeAuth, er is een codeResponse en de userHasPrivilegedRole, dus next() gaat aangeroepen worden.`)
            next();
          } else {
            throw new Error('Not validated with Unique Code');
          }
        })
        .catch((error) => {
          console.log('error',error);

          if (errorCallback) {
            try {
              errorCallback(req, res, next);
            } catch (err) {
              next(err)
            }
          } else {
            next(error);
          }
        });

      } else {
        console.log(`Mw client 'checkUniqueCodeAuth, unieke code is niet een van de auth types, dus next() gaat aangeroepen worden.`)
        next();
      }
    }
}



exports.checkPhonenumberAuth = (errorCallback) => {
  console.log("==> Running client middleware 'checkPhonenumberAuth'")
  //validate code auth type
  return (req, res, next) => {
    const authTypes = req.client.authTypes;

    // if UniqueCode authentication is used, other methods are blocked to enforce users can never authorize with email
    if (authTypes.indexOf('Phonenumber') !== -1) {
      const userHasPrivilegedRole = privilegedRoles.indexOf(req.user.role) > -1;

      // if phonenumber is validated or user has priviliged role
      // we check for this method if a phone number is validated
      // this could theoretically mean a user connects an email to their account
      // and is able to use session login with e-mail from other client to this client
      // (this is done by going directly to the authorize url, the user then has an active session, and as long as that role isset the user is logged in)
      // currently all checks are done on requirements of a user: "email exists", "unique code is connected" "phoneNumber is confirmed" etc.
      // but this is acceptable in current use cas

      if (req.user.phoneNumberConfirmed || userHasPrivilegedRole ) {
        next();
      } else {
        throw new Error('Not validated with Phone number');
      }

    } else {
      console.log(`Mw client 'checkPhonenumberAuth', phone number zit niet bij de auth types, dus next gaat aangeroepen worden. Authtypes zijn: ${authTypes}`)
      next();
    }
  }
}

/**
 * Check if 2FA is required and for what roles
 */
exports.check2FA = (req, res, next) => {
  console.log("==> Running client middleware 'check2FA'")
  const twoFactorRoles =  req.client.twoFactorRoles;

  console.log("==> twoFactorToles: ", twoFactorRoles)

  // if no role is present, assume default role
  const userRole = req.user.role ? req.user.role : defaultRole;

  console.log("==> userRole: ", userRole)

  /**
   * In case no 2factor roles are defined all is good and check is passed
   */
  if (!twoFactorRoles) {
    console.log(`Mw client 'check2FA', geen twoFactorRoles gevonden, dus alles is ok, gaat next() aanroepen.`)
    return next();
  }

  /**
   * In case 2factor roles are defined but the user doesn't fall into the role, all is good and check is passed
   * This is because in most cases only moderators, admin etc. are asked for 2fa, normal users not
   * So opposite of most security practices 2FA is trickle up instead of trickle down
   */
  if (twoFactorRoles && !twoFactorRoles.includes(userRole)) {
    console.log(`Mw client 'check2FA', er zijn twoFactorRoles gevonden, namelijk ${twoFactorRoles}, maar de user heeft een andere rol dus hoeft geen 2FA te doen, namelijk ${userRole}. Roept next() aan.`)
    return next();
  }

  // check two factor is validated otherwise send to 2factor screen
  if (twoFactorRoles && twoFactorRoles.includes(userRole) && req.session.twoFactorValid) {
    console.log(`Mw client 'check2FA', de user moet 2FA gebruiken, maar deze is al valid. Dus alles goed, next() wordt aangeroepen.`)
    return next();
  } else if (twoFactorRoles && twoFactorRoles.includes(userRole) && !req.session.twoFactorValid) {
    console.log(`Mw client 'check2FA', de user moet 2FA gebruiken, en dit is nog niet gedaan. De gebruiker gaat dus geredirect worden naar: /auth/two-factor?clientId=${req.client.clientId}&redirect_uri=${encodeURIComponent(req.query.redirect_uri)}`)
    return res.redirect(`/auth/two-factor?clientId=${req.client.clientId}&redirect_uri=${encodeURIComponent(req.query.redirect_uri)}`);
  }


  try {
    throw new Error(`Two factor authentication not handled properly for client with ID: ${req.client.id} but not turned on for user with ID: ${req.user.id}`)
  } catch (err) {
    next(err)
  }
}


/**
 * Check if required fields is set
 */
exports.checkRequiredUserFields = (req, res, next) => {
  console.log("==> Running client middleware 'checkRequiredUserFields'")
  const requiredFields = req.client.requiredUserFields;
  const user = req.user;
  let error;
  console.log(`Mw client 'checkRequiredUserFields', requiredFields: ${requiredFields}`)
  if (requiredFields) {
    requiredFields.forEach((field) => {
      console.log(`Mw client 'checkRequiredUserFields', check user voor requiredField: ${field}`)
      // if at least one required field is empty, set to error
      error = error || !req.user[field];
      console.log(`Mw client 'checkRequiredUserFields', vond bij checken voor requiredField een error?: ${error}`)
    });
  }

  // if error redirect to register
  if (error) {
    console.log(`Mw client 'checkRequiredUserFields', error gevonden dus redirect naar: /auth/required-fields?clientId=${req.client.clientId}&redirect_uri=${encodeURIComponent(req.query.redirect_uri)}`)
    res.redirect(`${process.env.APP_URL}/auth/required-fields?clientId=${req.client.clientId}&redirect_uri=${encodeURIComponent(req.query.redirect_uri)}`);
  } else {
    console.log(`Mw client 'checkRequiredUserFields', geen requiredField errors gevonden, roept next() aan`)
    next();
  }
}

exports.create =  (req, res, next) => {
  const { name, description, exposedUserFields, requiredUserFields, siteUrl, redirectUrl, authTypes, config, allowedDomains, twoFactorRoles } = req.body;
  const rack = hat.rack();
  const clientId = rack();
  const clientSecret = rack();

  const values = { name, description, exposedUserFields, requiredUserFields, siteUrl, redirectUrl, authTypes, clientId, clientSecret, allowedDomains, config, twoFactorRoles};

  db.Client
    .create(values)
    .then((client) => {
      req.client = client;
      next();
    })
    .catch((err) => { next(err); });
}

exports.update = (req, res, next) => {
  const { name, description, exposedUserFields, requiredUserFields, redirectUrl, siteUrl, authTypes, config, allowedDomains, twoFactorRoles } = req.body;

  req.client
    .update({
      name,
      description,
      siteUrl,
      redirectUrl,
      exposedUserFields,
      requiredUserFields,
      authTypes,
      config,
      allowedDomains,
      twoFactorRoles,
    })
    .then((client) => {
      next();
    })
    .catch((err) => {
      console.log('update err', err);
      next(err);
    })
}

exports.deleteOne = (req, res, next) => {
  req.client
    .destroy()
    .then((response) => {
      next();
    })
    .catch((err) => { next(err); })
}
