// Титр кадра → карточки до N слов. Та же логика, что в scripts/check.mjs
export const toCards = (text: string, maxWords: number): string[] => {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
    const w = sentence.split(/\s+/);
    // Делим ровно, чтобы не оставлять «висящее» слово на отдельной карточке
    const parts = Math.ceil(w.length / maxWords);
    const size = Math.ceil(w.length / parts);
    for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size).join(" "));
  }
  return out;
};
