const KEY = process.env.EXPO_PUBLIC_OCR_KEY;

export const ocrEnabled = !!KEY;

export async function readTextFromImage(base64, mime = 'image/jpeg') {
  const form = new FormData();
  form.append('apikey', KEY);
  form.append('base64Image', `data:${mime};base64,${base64}`);
  form.append('language', 'eng');
  form.append('scale', 'true');
  form.append('OCREngine', '2');

  const res = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: form,
  });
  const data = await res.json();

  if (data.IsErroredOnProcessing) {
    const m = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(' ') : data.ErrorMessage;
    throw new Error(m || 'OCR failed');
  }

  return (data.ParsedResults || [])
    .map(r => r.ParsedText)
    .join('\n')
    .trim();
}