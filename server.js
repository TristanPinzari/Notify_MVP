import express from "express";
import cors from "cors";
import { fetchTranscript } from "youtube-transcript-plus";

const app = express();
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }));

app.get("/transcript/:videoId", async (req, res) => {
  try {
    const transcript = await fetchTranscript(req.params.videoId);
    const text = transcript.map((segment) => segment.text).join(" ");
    res.json(text);
  } catch (err) {
    console.error("Transcript error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
