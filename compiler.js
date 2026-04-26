import { GoogleGenAI } from "@google/genai";
import { extractTextFromPDF, getTranscript } from "./pdf";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_KEY });

export async function generateCompiledDoc(
  collection,
  bulletFormat,
  grammarCheck,
  factCheck,
  extraInfo,
) {
  const text = await generateText(
    collection,
    bulletFormat,
    grammarCheck,
    factCheck,
    extraInfo,
  );
  let innerHTML = ``;
  const lines = text.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    const toHtml = (t) => t.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

    if (line.startsWith("## ")) {
      innerHTML += `<h2 style="font-size:1.4rem; font-weight:700; margin: 1.5rem 0 0.5rem;">${toHtml(line.slice(3))}</h2>`;
      i++;
    } else if (line.startsWith("- ")) {
      let items = "";
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items += `<li style="margin-bottom: 4px;">${toHtml(lines[i].trim().slice(2))}</li>`;
        i++;
      }
      innerHTML += `<ul style="list-style: disc; padding-left: 1.25rem; margin-bottom: 0.75rem;">${items}</ul>`;
    } else {
      innerHTML += `<p style="font-size: 0.875rem; line-height: 1.6; margin-bottom: 0.5rem;">${toHtml(line)}</p>`;
      i++;
    }
  }

  return innerHTML;
}

async function generateText(
  collection,
  bulletFormat,
  grammarCheck,
  factCheck,
  extraInfo,
) {
  const prompt = `
  You are merging multiple student notes into one clean master document.

  ## Output structure (always follow this order):
  1. A single short paragraph overview summarizing all topics covered at the top with the header "## Quick Summary".
  2. Thematically grouped sections, each with a header inferred from the content.
  3. Within each section, present all unique details from all documents.

  ## Merging rules:
  - If two sentences express the same fact, keep the clearest version only.
  - If two sentences are complementary (different details about the same topic), keep both.
  - If there is data that is wrong, ${factCheck ? `replace it with the correct data but add "[AI]" before the period of the sentence.` : `do not alter it but add "[SUS]" before the period of the sentence.`}
  - ${extraInfo ? `If extra information could be useful add it, but keep it short and add "[AI]" before the period of the sentence.` : "Never invent or infer information not present in the source documents."}
  - Ignore blank or empty documents entirely.

  ## Formatting rules:
  - Headers: use ## before section titles (e.g. ## Photosynthesis)
  - ${bulletFormat ? "Body: bullet points using '- ' for each fact or sentence." : "Body: paragraphs only, no bullet points. Separate paragraphs with a blank line."}
  - ${grammarCheck ? "Fix grammar and spelling errors." : "Preserve original grammar and phrasing as closely as possible."}
  - Bold section headers only using **double asterisks**. Do not bold keywords mid-sentence.
  - Separate each section with a blank line.
  - Output plain text only — no markdown code blocks, no HTML.
`;

  let lastResponse = "";
  const promises = Object.keys(collection).map((key) =>
    collection[key].isVideoUrl
      ? getTranscript(collection[key].videoId)
      : extractTextFromPDF(collection[key].fileUrl),
  );
  const texts = await Promise.all(promises);
  for (const text of texts) {
    const secondaryPrompt =
      prompt +
      `
    Document 1 text: ${lastResponse}

    Document 2 text: ${text}
    `;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: secondaryPrompt,
    });
    lastResponse = response.text;
  }
  return lastResponse;
}
