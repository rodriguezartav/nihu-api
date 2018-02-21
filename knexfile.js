module.exports = {

  development: {
    debug: false,
    client: 'postgresql',
    connection: {
      host: "localhost",
      database: "api",
      user: "",
      password: ""
    },
  },

  staging: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      database: "api-staging",
      user: "rodco",
      password: process.env.DB_PASSWORD,
      ssl: true
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST,
      database: "api",
      user: "rodco",
      password: process.env.DB_PASSWORD,
      ssl: true
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }

};
