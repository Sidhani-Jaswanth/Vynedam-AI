const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const MicrosoftStrategy = require("passport-microsoft").Strategy;
const User = require("../../models/user.model");
const logger = require("./logger");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "mock-google-client-id";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "mock-google-secret";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "mock-github-client-id";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "mock-github-secret";
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "mock-microsoft-client-id";
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "mock-microsoft-secret";
const DOMAIN = process.env.DOMAIN || "http://localhost:3001"; // Backend domain

async function handleOAuthCallback(providerName, providerIdField, profile, done) {
  try {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value.toLowerCase() : null;
    
    if (!email) {
      return done(new Error(`No email found in ${providerName} profile`));
    }

    let user = await User.findOne({ [providerIdField]: profile.id });
    
    if (user) {
      return done(null, user);
    }

    // Attempt to link to existing email if the provider isn't linked yet
    user = await User.findOne({ email });
    if (user) {
      user[providerIdField] = profile.id;
      await user.save();
      return done(null, user);
    }

    // Create new user if not found
    const name = profile.displayName || profile.username || email.split("@")[0];
    user = await User.create({
      name,
      email,
      [providerIdField]: profile.id,
    });
    
    return done(null, user);
  } catch (err) {
    logger.error({ err: err.message }, `OAuth error for ${providerName}`);
    return done(err);
  }
}

// Google
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: `${DOMAIN}/api/auth/google/callback`,
    },
    (accessToken, refreshToken, profile, done) => handleOAuthCallback("Google", "googleId", profile, done)
  )
);

// GitHub
passport.use(
  new GitHubStrategy(
    {
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: `${DOMAIN}/api/auth/github/callback`,
      scope: ["user:email"],
    },
    (accessToken, refreshToken, profile, done) => handleOAuthCallback("GitHub", "githubId", profile, done)
  )
);

// Microsoft
passport.use(
  new MicrosoftStrategy(
    {
      clientID: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      callbackURL: `${DOMAIN}/api/auth/microsoft/callback`,
      scope: ["user.read"],
    },
    (accessToken, refreshToken, profile, done) => handleOAuthCallback("Microsoft", "microsoftId", profile, done)
  )
);

module.exports = passport;
