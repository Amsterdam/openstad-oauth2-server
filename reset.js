require('dotenv').config();

const fs = require('fs').promises;
const constants = require('fs').constants;
const db = require('./db');

// check for force flag '-f' on commandline to force sync, like: node reset.js -f
const force = process.argv.includes('-f')

async function doReset() {

  try {

    console.log('Syncing...');

    await db.sequelize.sync({force})

    console.log('Adding default data...');
    let datafile = process.env.NODE_ENV || 'default';
    try {
      await fs.access(`./seeds/${datafile}`, constants.F_OK)
    } catch(err) {
      datafile = 'default';
    }
	  await require(`./seeds/${datafile}`)(db);

  } catch (err) {
    console.log(err);
  } finally {
	  db.sequelize.close();
  }
  
}

doReset();
