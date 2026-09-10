/**
 * Integration tests must not share the local `syncboard` database with
 * `npm run dev`, `npm run seed`, or a parallel Jest watch run — those
 * wipe collections in afterEach and race against this suite.
 */
const uri = process.env.MONGO_URI ?? "";
process.env.MONGO_URI = uri.replace(/\/([^/?]+)(\?|$)/, "/syncboard-test$2");
