import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { env } from "@/config/env.js";
import { UserModel } from "@/models/user.model.js";

passport.use(
    new JwtStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: env.JWT_SECRET,
        },
        async (payload: { sub: string }, done) => {
            try {
                const user = await UserModel.findById(payload.sub);
                done(null, user ?? false);
            } catch (error) {
                done(error, false);
            }
        },
    ),
);

export { passport };
