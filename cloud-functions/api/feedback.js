import app from "../../backend/app.js";

export default function handler(req, res) {
  req.url = "/api/feedback";
  return app(req, res);
}
