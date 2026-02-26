"use client"

import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  // Cabeçalho Principal
  headerSection: { borderBottomWidth: 2, borderBottomColor: '#1e40af', pb: 10, mb: 15 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e40af', letterSpacing: 1 },
  brand: { fontSize: 10, color: '#64748b', fontWeight: 'bold' },
  
  // Box de Filtros Aplicados
  filterBox: { backgroundColor: '#f8fafc', padding: 8, borderRadius: 4, mb: 15, borderLeftWidth: 3, borderLeftColor: '#94a3b8' },
  filterTitle: { fontSize: 7, color: '#64748b', marginBottom: 2, textTransform: 'uppercase' },
  filterText: { fontSize: 9, color: '#334155', flexDirection: 'row' },

  // Tabela
  table: { display: 'flex', width: '100%', marginTop: 10 },
  tableHeader: { 
    flexDirection: 'row', 
    backgroundColor: '#1e40af', 
    color: '#FFFFFF', 
    fontWeight: 'bold', 
    minHeight: 25, 
    alignItems: 'center',
    borderRadius: 2
  },
  tableRow: { 
    flexDirection: 'row', 
    borderBottomWidth: 0.5, 
    borderBottomColor: '#e2e8f0', 
    minHeight: 22, 
    alignItems: 'center' 
  },
  rowAlternate: { backgroundColor: '#f1f5f9' }, // Cor para efeito zebrado

  // Colunas (Larguras balanceadas para Landscape)
  colStatus: { width: '8%', padding: 4, fontWeight: 'bold' },
  colTitulo: { width: '22%', padding: 4 },
  colCliente: { width: '15%', padding: 4 },
  colTipo: { width: '15%', padding: 4 },
  colSolicitante: { width: '15%', padding: 4 },
  colData: { width: '12%', padding: 4 },
  colAtu: { width: '13%', padding: 4 },

  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, textAlign: 'center', color: '#94a3b8', fontSize: 7, borderTopWidth: 0.5, borderTopColor: '#e2e8f0', pt: 5 }
});

export const RelatorioSuportePDF = ({ dados, filtros }: { dados: any[], filtros: any }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      {/* HEADER */}
      <View style={styles.headerSection}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Relatório de Suporte</Text>
          <Text style={styles.brand}>AUXÍLIO DESENV v1.0</Text>
        </View>
      </View>

      {/* FILTROS APLICADOS */}
      <View style={styles.filterBox}>
        <Text style={styles.filterTitle}>Filtros da Busca:</Text>
        <Text style={styles.filterText}>
            Período: {filtros.dataInicio ? filtros.dataInicio.split('-').reverse().join('/') : 'Início'} 
            até {filtros.dataFim ? filtros.dataFim.split('-').reverse().join('/') : 'Hoje'} | 
            Helper: {filtros.helperId || "Todos"} | 
            Status: {filtros.status || "Todos"}
        </Text>
        </View>

      {/* TABELA */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.colStatus}>STATUS</Text>
          <Text style={styles.colTitulo}>TÍTULO</Text>
          <Text style={styles.colCliente}>CLIENTE</Text>
          <Text style={styles.colTipo}>TIPO AJUDA</Text>
          <Text style={styles.colSolicitante}>SOLICITANTE</Text>
          <Text style={styles.colData}>SOLICITAÇÃO</Text>
          <Text style={styles.colAtu}>ÚLT. ATUALIZ.</Text>
        </View>

        {dados.map((item, index) => (
          <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.rowAlternate : {}]}>
            <Text style={styles.colStatus}>{item.Status}</Text>
            <Text style={styles.colTitulo}>{item.Titulo}</Text>
            <Text style={styles.colCliente}>{item.Cliente}</Text>
            <Text style={styles.colTipo}>{item.TipoAjuda}</Text>
            <Text style={styles.colSolicitante}>{item.Solicitante}</Text>
            <Text style={styles.colData}>{item.DataSolicitacao}</Text>
            <Text style={styles.colAtu}>{item.UltAtualizacao}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footer}>
        Gerado em {new Date().toLocaleString('pt-BR')} - Documento Interno Auxílio Desenv
      </Text>
    </Page>
  </Document>
);