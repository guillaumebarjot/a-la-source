/**
 * Extraction du texte d'un PDF (pour proposer une version lisible en plus du
 * fichier : copies integrales Europresse, PJ Discord...). Defensif : renvoie ''
 * en cas d'echec (PDF scanne sans texte, protege, illisible), jamais d'exception.
 */
import { PDFParse } from 'pdf-parse'

export async function extrairePdfTexte(buf: Buffer): Promise<string> {
  let parser: PDFParse | null = null
  try {
    parser = new PDFParse({ data: buf })
    const res = await parser.getText()
    return (res.text || '').replace(/\n{3,}/g, '\n\n').trim()
  } catch (err) {
    console.error('extraction PDF: echec', err)
    return ''
  } finally {
    try { await parser?.destroy() } catch { /* ignore */ }
  }
}
