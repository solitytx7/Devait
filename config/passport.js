const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth Profile:', profile);
    
    // Kiểm tra xem user đã tồn tại với Google ID
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      // User đã tồn tại, cập nhật thông tin
      user.lastLogin = new Date();
      await user.save();
      return done(null, user);
    }
    
    // Kiểm tra xem có user nào với email này không (để liên kết tài khoản)
    user = await User.findOne({ email: profile.emails[0].value });
    
    if (user) {
      // Liên kết tài khoản Google với tài khoản hiện có
      user.googleId = profile.id;
      user.provider = 'google';
      user.avatar = user.avatar || profile.photos[0]?.value;
      user.lastLogin = new Date();
      await user.save();
      return done(null, user);
    }
    
    // Tạo user mới
    user = new User({
      googleId: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      avatar: profile.photos[0]?.value,
      provider: 'google',
      isActive: true,
      lastLogin: new Date()
    });
    
    await user.save();
    done(null, user);
    
  } catch (error) {
    console.error('Google OAuth Error:', error);
    done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;