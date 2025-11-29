import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.json({ message: "Backend OK 🚀" });
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
