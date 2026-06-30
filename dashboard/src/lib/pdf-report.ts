import { jsPDF } from 'jspdf';

export function generatePdfReport({ tokens, leads, userName }: { tokens: number; leads: any[]; userName: string }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 190;
  let y = 20;

  const header = () => {
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('GeoLeads', 15, 17);
    doc.setFontSize(8);
    doc.text('Relatório de Desempenho', 15, 24);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('pt-BR'), pageW, 17, { align: 'right' });
    y = 38;
  };

  const section = (title: string) => {
    doc.setFillColor(241, 245, 249);
    doc.rect(10, y, pageW, 8, 'F');
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, y + 5.5);
    y += 14;
  };

  const text = (label: string, value: string, color = '#1e293b') => {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 15, y);
    doc.setTextColor(color);
    doc.setFont('helvetica', 'bold');
    doc.text(value, 60, y);
    y += 6;
  };

  header();

  // Overview
  section('📊 Visão Geral');
  text('Saldo de Tokens:', tokens.toLocaleString('pt-BR'));
  text('Total de Leads no CRM:', leads.length.toString());
  text('Usuário:', userName);
  const stages = ['Novo', 'Em Contato', 'Proposta', 'Fechado', 'Perdido'];
  const stageCounts: Record<string, number> = {};
  const monthCounts: Record<string, number> = {};
  for (const l of leads) {
    const s = l.stage || 'Novo';
    stageCounts[s] = (stageCounts[s] || 0) + 1;
    if (l.savedAt || l.saved_at) {
      const d = new Date(l.savedAt || l.saved_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
  }

  y += 4;

  // Leads by Stage table
  section('📋 Leads por Estágio');
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 250, 252);
  doc.rect(15, y - 4, 80, 6, 'F');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Estágio', 17, y);
  doc.text('Qtd', 75, y);
  doc.line(15, y + 2, 95, y + 2);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  for (const s of stages) {
    const count = stageCounts[s] || 0;
    if (count === 0) continue;
    doc.text(s, 17, y);
    doc.text(count.toString(), 75, y);
    y += 5;
  }
  doc.text('Total', 17, y);
  doc.setFont('helvetica', 'bold');
  doc.text(leads.length.toString(), 75, y);
  y += 8;

  // Leads by Month table
  if (Object.keys(monthCounts).length > 0) {
    section('📈 Leads por Mês');
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, y - 4, 80, 6, 'F');
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Mês', 17, y);
    doc.text('Qtd', 75, y);
    doc.line(15, y + 2, 95, y + 2);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const sorted = Object.entries(monthCounts).sort(([a], [b]) => a.localeCompare(b));
    for (const [month, count] of sorted) {
      doc.text(month, 17, y);
      doc.text(count.toString(), 75, y);
      y += 5;
    }
    y += 6;
  }

  // Footer
  if (y > 260) { doc.addPage(); y = 20; header(); }
  doc.setDrawColor(200, 200, 200);
  doc.line(10, y, pageW + 10, y);
  y += 5;
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerado por GeoLeads em ' + new Date().toLocaleString('pt-BR'), 15, y);

  doc.save(`geoleads-relatorio-${new Date().toISOString().slice(0, 10)}.pdf`);
}
