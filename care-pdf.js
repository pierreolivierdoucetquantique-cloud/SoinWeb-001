// =========================================================
// PIERRE-OLIVIER — care-pdf.js
//
// Génération du PDF de résumé de séance (Soin Interactif), via la
// librairie jsPDF chargée en CDN. Utilisé à la fois sur
// soin-interactif.html (juste après la fin de la séance) et sur
// profil.html (depuis l'historique, pour re-télécharger un résumé
// déjà complété).
//
// SIMULATION FRONTEND UNIQUEMENT — le PDF est généré entièrement
// dans le navigateur du client, à partir des données stockées en
// localStorage. Dans un vrai backend, ce document devrait être
// généré et archivé côté serveur pour garantir son intégrité.
// =========================================================

const PO_CarePdf = (() => {

  function generate(summary, careTitle) {
    if (typeof window.jspdf === 'undefined') {
      window.print();
      return false;
    }
    const dateStr = new Date(summary.completedAt).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Ntabou Aka Wé — Résumé de séance', 20, y); y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Soin : ${careTitle}`, 20, y); y += 7;
    doc.text(`Client : ${summary.clientName}`, 20, y); y += 7;
    doc.text(`Date : ${dateStr}`, 20, y); y += 7;
    doc.text(`Durée : ${summary.durationMinutes} minutes`, 20, y); y += 7;
    doc.text(`Référence : ${summary.transactionId}`, 20, y); y += 12;

    doc.setFont('helvetica', 'bold');
    doc.text('Déroulement de la séance', 20, y); y += 8;
    doc.setFont('helvetica', 'normal');

    (summary.steps || []).forEach(step => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${step.title}`, 20, y); y += 6;
      doc.setFont('helvetica', 'normal');
      if (step.question) {
        const qLines = doc.splitTextToSize(`${step.question}`, 165);
        doc.text(qLines, 24, y); y += qLines.length * 6;
        const aLines = doc.splitTextToSize(`Réponse : ${step.answer || '—'}`, 165);
        doc.text(aLines, 24, y); y += aLines.length * 6 + 2;
      } else {
        y += 2;
      }
    });

    y += 8;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    const footerLines = doc.splitTextToSize('Document généré automatiquement à titre de démonstration. Ne remplace pas un suivi médical.', 165);
    doc.text(footerLines, 20, Math.min(y, 285));

    doc.save(`resume-soin-${summary.id}.pdf`);

    if (typeof PO_Care !== 'undefined') {
      PO_Care.markPdfGenerated(summary.id);
    }
    return true;
  }

  return { generate };
})();
