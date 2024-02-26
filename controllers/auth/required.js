const userFields = require('../../config/user').fields;

exports.index = (req, res, next) => {
  let requiredUserFields = req.client.requiredUserFields;

  requiredUserFields = requiredUserFields.map((field) => {
    return userFields.find(userField => userField.key === field);
  })

  requiredUserFields = requiredUserFields.filter(field => !req.user[field.key]);

  const config = req.client.config ? req.client.config : {};
  const configRequiredFields = config && config.requiredFields ? config.requiredFields : {};
  
  // Replace field labels with labels defined in the client config (if provided)
  if (configRequiredFields && configRequiredFields.labels) {
    requiredUserFields = requiredUserFields.map((field) => {
      if (configRequiredFields.labels[field.key]) {
        field.label = configRequiredFields.labels[field.key];
      }

      return field;
    });
  }

  res.render('auth/required-fields', {
    client: req.client,
    clientId: req.client.clientId,
    requiredFields: requiredUserFields,
    info: configRequiredFields.info,
    description: configRequiredFields.description,
    title: configRequiredFields.title,
    buttonText: configRequiredFields.buttonText,
    redirect_uri: encodeURIComponent(req.query.redirect_uri),
    appUrl: process.env.APP_URL
  });
}

exports.post = (req, res, next) => {
  const clientRequiredUserFields = req.client.requiredUserFields;
  const redirectUrl = req.query.redirect_uri ? encodeURIComponent(req.query.redirect_uri) : req.client.redirectUrl;

  let data = {};
  clientRequiredUserFields.forEach((field) => {
    if (field === 'email' && !!req.user.email)  {
      //break;
    } else if (req.body[field]) {
      data[field] = req.body[field];
    }
  });

  req.user
    .update(data)
    .then(() => {
      let authorizeUrl = `/dialog/authorize?redirect_uri=${redirectUrl}&response_type=code&client_id=${req.client.clientId}&scope=offline`;
      // Set complete URL including domain for Amsterdam Azure implementation - 31415
      authorizeUrl = process.env.APP_URL + authorizeUrl
      res.redirect(authorizeUrl);
    })
    .catch((err) => {
      next(err);
    });
}
