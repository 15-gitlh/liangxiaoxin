import app from "../app.js";

export default function handler(req, res) {
  req.url = "/api/chat";
  return app(req, res);
}
