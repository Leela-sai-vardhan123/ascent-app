// Server-side PDF text extraction. Runs on Vercel's servers (Node runtime),
// so it can use pdf-parse, which doesn't work in the browser.

export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { base64 } = req.body || {};
  if (!base64) {
    return res.status(400).json({ error: "Missing file data" });
  }

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = Buffer.from(base64, "base64");
    const data = await pdfParse(buffer);
    return res.status(200).json({ text: data.text });
  } catch (err) {
    return res.status(500).json({ error: "Couldn't read that PDF. It may be a scanned image rather than text-based." });
  }
}
