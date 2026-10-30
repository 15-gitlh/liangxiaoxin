import app from "../../../backend/app.js";

export default function handler(req, res) {
  req.url = "/api/admin/reindex";
  return app(req, res);
}
