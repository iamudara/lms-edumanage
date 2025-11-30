/**
 * Passport Configuration
 * Authentication strategies and serialization
 * Implemented in Phase 2 (Task 2.1)
 */

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { User } from '../models/index.js';

/**
 * LocalStrategy Configuration
 * Authenticates users using username/email and password
 */
passport.use(
  new LocalStrategy(
    {
      usernameField: 'username', // Can be username or email
      passwordField: 'password',
    },
    async (username, password, done) => {
      try {
        // Find user by username or email
        const user = await User.findOne({
          where: {
            [User.sequelize.Sequelize.Op.or]: [
              { username: username },
              { email: username },
            ],
          },
        });

        // User not found
        if (!user) {
          return done(null, false, { message: 'Invalid username or password' });
        }

        // Compare password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          return done(null, false, { message: 'Invalid username or password' });
        }

        // Authentication successful
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

/**
 * Serialize User
 * Determines which data of the user object should be stored in the session
 * Only user ID is stored in session (minimizes session size)
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

/**
 * Deserialize User
 * Retrieves user object from database using ID stored in session
 * Called on every request to populate req.user
 */
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id, {
      attributes: ['id', 'username', 'email', 'full_name', 'role', 'batch_id'],
    });

    if (!user) {
      return done(null, false);
    }

    done(null, user);
  } catch (error) {
    done(error);
  }
});

console.log('✅ Passport configuration loaded successfully');

export default passport;
