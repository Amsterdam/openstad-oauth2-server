const hat = require('hat');
const db = require('../../db');

exports.all = (req, res, next) => {
  res.render('admin/role/all', {
    roles: req.roles,
    appUrl: process.env.APP_URL
  });
}

exports.new = (req, res, next) => {
  res.render('admin/role/new', {
    appUrl: process.env.APP_URL
  });
}

exports.edit = (req, res, next) => {
  res.render('admin/role/edit', {
    role: req.role,
    appUrl: process.env.APP_URL
  });
}

/**
 * @TODO validation in middleware
 */
exports.create = (req, res, next) => {
  const { name} = req.body;

  db.Role()
    .create({ name })
    .then((response) => {
      req.flash('success', { msg: 'Succesfully created '});
      res.redirect(`${process.env.APP_URL}/admin/roles`);
    })
    .catch((err) => { next(err); });
}

exports.update = (req, res, next) => {
  const { name } = req.body;

  req.role
    .update({name})
    .then((response) => {
      req.flash('success', { msg: 'Updated role!'});
      res.redirect(`${process.env.APP_URL}/admin/role/` + response.get('id')  || process.env.APP_URL);
    })
    .catch((err) => { next(err); })
}
