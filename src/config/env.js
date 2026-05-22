require('dotenv').config();
const Joi = require('joi');

const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('production', 'development', 'test').default('development'),
  PORT: Joi.number().default(3000),
  VERIFY_TOKEN: Joi.string().required().description('Meta Webhook Verify Token'),
  IG_ACCESS_TOKEN: Joi.string().required().description('Instagram Page Access Token'),
  APP_SECRET: Joi.string().required().description('Meta App Secret for HMAC'),
  SUPABASE_URL: Joi.string().required().description('Supabase Project URL'),
  SUPABASE_ANON_KEY: Joi.string().required().description('Supabase Service Role Key'),
  ADMIN_USERNAME: Joi.string().default('admin'),
  ADMIN_PASSWORD: Joi.string().default('password123')
}).unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  meta: {
    verifyToken: envVars.VERIFY_TOKEN,
    accessToken: envVars.IG_ACCESS_TOKEN,
    appSecret: envVars.APP_SECRET,
    igVersion: 'v19.0'
  },
  supabase: {
    url: envVars.SUPABASE_URL,
    key: envVars.SUPABASE_ANON_KEY
  },
  admin: {
    username: envVars.ADMIN_USERNAME,
    password: envVars.ADMIN_PASSWORD
  }
};
