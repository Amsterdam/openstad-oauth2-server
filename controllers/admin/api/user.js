const db = require('../../../db');
const hat = require('hat');

const removeSensitiveUserDetails = (user) => (({ password, hashedPhoneNumber, twoFactorToken,...redactedUser }) => redactedUser)(user);

const outputUser = (req, res, next) => {
  res.json(removeSensitiveUserDetails(req.userObject.dataValues));
};

exports.all = (req, res, next) => {
    res.json({
        total: req.totalCodeCount,
        data: req.users.map((user) => removeSensitiveUserDetails(user.dataValues))
    });
};

exports.show = [
    outputUser
];

exports.create = [
    outputUser
];

exports.update = [
    outputUser
];

exports.delete = [
    (req, res, next) => {
        res.json({'message': 'Deleted!'})
    }
]

exports.csrfSessionToken = [
    (req, res, next) => {
        const rack = hat.rack();
        const token = rack();

        db.ExternalCsrfToken
            .create({
                token: token,
                used: false
            })
            .then((response) => {
                res.json({'token': token})
            })
            .catch((err) => {
                next(err);
            });
    }
]
